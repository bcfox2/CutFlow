import "dotenv/config";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, basename, dirname, extname, resolve } from "node:path";
import { homedir } from "node:os";
import { Command } from "commander";
import { intro, outro, log, spinner, note, cancel } from "@clack/prompts";
import { loadConfig, getCapCutProjectsDir } from "../config/config.js";
import { parseScript } from "../parser/script-parser.js";
import { runPipeline } from "../pipeline.js";
import { MICROSECONDS_PER_SECOND } from "../types/index.js";
import type { ImageEngine } from "../types/index.js";

const program = new Command();

program
  .name("cutflow")
  .description("대본만 넣으면 CapCut 프로젝트 파일로 완성하는 CLI 도구")
  .version("0.3.0");

// 간단한 glob 매칭 (*.txt, ?.md 수준, ReDoS 안전)
function matchGlob(fileName: string, pattern: string): boolean {
  let fi = 0;
  let pi = 0;
  let starIdx = -1;
  let matchIdx = 0;
  while (fi < fileName.length) {
    if (
      pi < pattern.length &&
      (pattern[pi] === "?" || pattern[pi] === fileName[fi])
    ) {
      fi++;
      pi++;
    } else if (pi < pattern.length && pattern[pi] === "*") {
      starIdx = pi;
      matchIdx = fi;
      pi++;
    } else if (starIdx !== -1) {
      pi = starIdx + 1;
      matchIdx++;
      fi = matchIdx;
    } else {
      return false;
    }
  }
  while (pi < pattern.length && pattern[pi] === "*") pi++;
  return pi === pattern.length;
}

// Windows glob 확장 (CMD/PowerShell은 glob을 자동 확장하지 않음)
async function expandGlobs(patterns: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const pattern of patterns) {
    if (pattern.includes("*") || pattern.includes("?")) {
      const dir = dirname(pattern) || ".";
      const glob = basename(pattern);
      try {
        const files = await readdir(resolve(dir));
        for (const file of files.sort()) {
          if (matchGlob(file, glob)) results.push(resolve(dir, file));
        }
      } catch {
        results.push(pattern);
      }
    } else {
      results.push(pattern);
    }
  }
  return results;
}

// ─── generate 명령어 ───
program
  .command("generate")
  .description("대본 파일에서 CapCut 프로젝트 생성")
  .argument("<scripts...>", "대본 파일 경로 (.txt/.md, 여러 파일 또는 *.txt)")
  .option(
    "-o, --output <dir>",
    "출력 폴더 (기본: CapCut 프로젝트 폴더 자동 감지)",
  )
  .option("-n, --name <name>", "프로젝트 이름")
  .option("-v, --voice <id>", "ElevenLabs Voice ID")
  .option("-e, --engine <type>", "이미지 엔진 (grok|gemini|imagen)", "grok")
  .option(
    "-s, --style <style>",
    "이미지 스타일 (realistic|illustration|anime|cinematic)",
    "realistic",
  )
  .option("--canvas <WxH>", "캔버스 크기", "1920x1080")
  .option("--dry-run", "API 호출 없이 대본 파싱 결과만 표시")
  .action(async (scripts: string[], opts: Record<string, string | boolean>) => {
    intro("CutFlow v0.3");

    // glob 확장
    const scriptPaths = await expandGlobs(scripts);
    if (scriptPaths.length === 0) {
      cancel("대본 파일을 찾을 수 없습니다.");
      process.exit(1);
      return;
    }

    // --dry-run 모드
    if (opts.dryRun) {
      for (const scriptPath of scriptPaths) {
        let text: string;
        try {
          text = await readFile(scriptPath, "utf-8");
        } catch {
          log.error(`파일을 읽을 수 없습니다: ${scriptPath}`);
          continue;
        }

        const result = parseScript(text);
        if (!result.ok) {
          log.error(`[${result.error.code}] ${result.error.message}`);
          continue;
        }

        const lines = result.data.map(
          (s) =>
            `  장면 ${s.index + 1}: ${s.narration.slice(0, 60)}${s.narration.length > 60 ? "..." : ""}`,
        );
        note(
          lines.join("\n"),
          `${basename(scriptPath)} — ${result.data.length}개 장면`,
        );
      }
      outro("API 호출 없이 종료. --dry-run을 제거하면 실제 생성됩니다.");
      return;
    }

    // 캔버스 파싱
    const canvasStr =
      typeof opts.canvas === "string" ? opts.canvas : "1920x1080";
    const canvasParts = canvasStr.split("x").map(Number);
    const canvas = {
      width: canvasParts[0] || 1920,
      height: canvasParts[1] || 1080,
      ratio: "original",
    };

    // 설정 로드
    const configResult = await loadConfig({
      imageEngine: (typeof opts.engine === "string"
        ? opts.engine
        : "grok") as ImageEngine,
      outputDir: typeof opts.output === "string" ? opts.output : undefined,
      projectName: typeof opts.name === "string" ? opts.name : undefined,
      elevenLabsVoiceId:
        typeof opts.voice === "string" ? opts.voice : undefined,
      imageStyle: typeof opts.style === "string" ? opts.style : undefined,
      canvas,
    });

    if (!configResult.ok) {
      cancel(`[${configResult.error.code}] ${configResult.error.message}`);
      process.exit(1);
      return;
    }
    const config = configResult.data;
    const autoOutput = typeof opts.output !== "string";

    log.info(
      `엔진: ${config.imageEngine} | 스타일: ${config.imageStyle} | 캔버스: ${canvas.width}x${canvas.height}`,
    );

    const isBatch = scriptPaths.length > 1;
    if (isBatch) {
      log.info(`배치 모드: ${scriptPaths.length}개 대본`);
    }

    // 각 대본 순차 처리
    const results: Array<{
      file: string;
      ok: boolean;
      path?: string;
      scenes?: number;
      duration?: number;
      error?: string;
    }> = [];

    for (let i = 0; i < scriptPaths.length; i++) {
      const scriptPath = scriptPaths[i];
      const fileName = basename(scriptPath);

      // 배치 프로젝트 이름 결정
      const projectName = config.projectName
        ? isBatch
          ? `${config.projectName} - ${basename(scriptPath, extname(scriptPath))}`
          : config.projectName
        : basename(scriptPath, extname(scriptPath));

      const s = spinner();
      const prefix = isBatch ? `[${i + 1}/${scriptPaths.length}] ` : "";
      s.start(`${prefix}${fileName} 처리 중...`);

      const result = await runPipeline(
        scriptPath,
        { ...config, projectName },
        (event) => {
          s.message(`${prefix}${event.message}`);
        },
      );

      if (result.ok) {
        const { projectPath, sceneCount, totalDuration } = result.data;
        const sec = Math.round(totalDuration / MICROSECONDS_PER_SECOND);
        s.stop(`${prefix}${fileName} 완료 (${sceneCount}개 장면, ${sec}초)`);
        results.push({
          file: fileName,
          ok: true,
          path: projectPath,
          scenes: sceneCount,
          duration: sec,
        });
      } else {
        s.stop(`${prefix}${fileName} 실패`);
        log.error(`[${result.error.code}] ${result.error.message}`);
        results.push({
          file: fileName,
          ok: false,
          error: result.error.message,
        });
        if (!isBatch) {
          process.exit(1);
          return;
        }
      }
    }

    // 결과 요약
    const succeeded = results.filter((r) => r.ok);
    if (succeeded.length === 0) {
      cancel("모든 프로젝트 생성에 실패했습니다.");
      process.exit(1);
      return;
    }

    const outputNote = autoOutput ? " (자동 감지)" : "";
    if (isBatch) {
      const summary = succeeded
        .map(
          (r) =>
            `  ${r.file}: ${r.scenes}개 장면, ${r.duration}초\n    → ${r.path}`,
        )
        .join("\n");
      const failed = results.filter((r) => !r.ok);
      const failNote =
        failed.length > 0
          ? `\n\n  실패: ${failed.map((r) => r.file).join(", ")}`
          : "";
      note(
        `${summary}${failNote}`,
        `${succeeded.length}/${results.length}개 완료${outputNote}`,
      );
    } else {
      const r = succeeded[0];
      note(
        `  장면: ${r.scenes}개 | 길이: ${r.duration}초\n  경로: ${r.path}`,
        `CapCut 프로젝트 생성 완료${outputNote}`,
      );
    }

    outro("CapCut을 열어 프로젝트를 확인하세요");
  });

// ─── init 명령어 ───
program
  .command("init")
  .description("설정 파일(.cutflowrc) 생성")
  .action(async () => {
    const rcPath = join(process.cwd(), ".cutflowrc");
    const capCutDir = getCapCutProjectsDir();

    const config = {
      imageEngine: "grok",
      xaiApiKey: process.env.XAI_API_KEY || "",
      googleApiKey: process.env.GOOGLE_API_KEY || "",
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
      elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "",
      outputDir: capCutDir || "",
      imageStyle: "realistic",
      imageSize: "1920x1080",
      ttsModel: "eleven_multilingual_v2",
    };

    await writeFile(rcPath, JSON.stringify(config, null, 2), "utf-8");
    console.log(".cutflowrc 생성 완료:", rcPath);
    console.log("");
    console.log("API 키를 설정하세요:");
    if (!config.xaiApiKey)
      console.log("  - xaiApiKey: xAI API 키 (https://console.x.ai)");
    if (!config.googleApiKey)
      console.log(
        "  - googleApiKey: Google API 키 (https://aistudio.google.com)",
      );
    if (!config.elevenLabsApiKey)
      console.log(
        "  - elevenLabsApiKey: ElevenLabs API 키 (https://elevenlabs.io)",
      );
    if (!config.elevenLabsVoiceId)
      console.log("  - elevenLabsVoiceId: ElevenLabs Voice ID");
    if (capCutDir) {
      console.log(`\nCapCut 프로젝트 폴더 감지됨: ${capCutDir}`);
    } else {
      console.log(
        "\nCapCut 프로젝트 폴더를 찾을 수 없습니다. outputDir를 수동 설정하세요.",
      );
    }
  });

// ─── config 명령어 ───
program
  .command("config")
  .description("설정값 확인/변경")
  .argument("[key]", "설정 키 (없으면 전체 표시)")
  .argument("[value]", "설정할 값")
  .action(async (key?: string, value?: string) => {
    const rcPath = join(process.cwd(), ".cutflowrc");
    let config: Record<string, unknown> = {};

    try {
      const content = await readFile(rcPath, "utf-8");
      config = JSON.parse(content);
    } catch {
      try {
        const content = await readFile(join(homedir(), ".cutflowrc"), "utf-8");
        config = JSON.parse(content);
      } catch {
        console.log(
          ".cutflowrc 파일이 없습니다. `cutflow init`으로 생성하세요.",
        );
        return;
      }
    }

    if (!key) {
      for (const [k, v] of Object.entries(config)) {
        const display =
          k.toLowerCase().includes("key") || k.toLowerCase().includes("apikey")
            ? String(v).slice(0, 8) + "..."
            : String(v);
        console.log(`  ${k}: ${display}`);
      }
      return;
    }

    if (!value) {
      const v = config[key];
      console.log(
        v !== undefined ? `${key}: ${v}` : `${key}를 찾을 수 없습니다.`,
      );
      return;
    }

    config[key] = value;
    await writeFile(rcPath, JSON.stringify(config, null, 2), "utf-8");
    console.log(`${key} = ${value} (저장됨)`);
  });

program.parse();
