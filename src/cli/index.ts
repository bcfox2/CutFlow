import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { Command } from "commander";
import { loadConfig, getCapCutProjectsDir } from "../config/config.js";
import { parseScript } from "../parser/script-parser.js";
import { runPipeline } from "../pipeline.js";
import { MICROSECONDS_PER_SECOND } from "../types/index.js";

const program = new Command();

program
  .name("cutflow")
  .description("대본만 넣으면 CapCut 프로젝트 파일로 완성하는 CLI 도구")
  .version("0.2.0");

// ─── generate 명령어 ───
program
  .command("generate")
  .description("대본 파일에서 CapCut 프로젝트 생성")
  .argument("<script>", "대본 파일 경로 (.txt/.md)")
  .option("-o, --output <dir>", "출력 폴더 (기본: CapCut 프로젝트 폴더)")
  .option("-n, --name <name>", "프로젝트 이름")
  .option("-v, --voice <id>", "ElevenLabs Voice ID")
  .option(
    "-s, --style <style>",
    "이미지 스타일 (realistic|illustration|anime|cinematic)",
    "realistic",
  )
  .option("--canvas <WxH>", "캔버스 크기", "1920x1080")
  .option("--dry-run", "API 호출 없이 대본 파싱 결과만 표시")
  .action(
    async (scriptPath: string, opts: Record<string, string | boolean>) => {
      console.log("CutFlow - CapCut 프로젝트 생성기\n");

      // --dry-run 모드: 대본 파싱만 수행
      if (opts.dryRun) {
        let text: string;
        try {
          text = await readFile(scriptPath, "utf-8");
        } catch {
          console.error("오류: 대본 파일을 읽을 수 없습니다:", scriptPath);
          process.exit(1);
          return;
        }

        const result = parseScript(text);
        if (!result.ok) {
          console.error(`오류 [${result.error.code}]: ${result.error.message}`);
          process.exit(1);
          return;
        }

        console.log(`[dry-run] 대본 파싱 결과: ${result.data.length}개 장면\n`);
        for (const scene of result.data) {
          console.log(`  장면 ${scene.index + 1}:`);
          console.log(
            `    나레이션: ${scene.narration.slice(0, 80)}${scene.narration.length > 80 ? "..." : ""}`,
          );
          console.log(
            `    이미지: ${scene.imagePrompt.slice(0, 80)}${scene.imagePrompt.length > 80 ? "..." : ""}`,
          );
          if (scene.direction) console.log(`    연출: ${scene.direction}`);
          console.log("");
        }
        console.log(
          "API 호출 없이 종료. --dry-run 옵션을 제거하면 실제 생성됩니다.",
        );
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
        outputDir: typeof opts.output === "string" ? opts.output : undefined,
        projectName: typeof opts.name === "string" ? opts.name : undefined,
        elevenLabsVoiceId:
          typeof opts.voice === "string" ? opts.voice : undefined,
        imageStyle: typeof opts.style === "string" ? opts.style : undefined,
        canvas,
      });

      if (!configResult.ok) {
        console.error(
          `오류 [${configResult.error.code}]: ${configResult.error.message}`,
        );
        process.exit(1);
        return;
      }
      const config = configResult.data;

      console.log("대본 파일:", scriptPath);
      console.log("이미지 스타일:", config.imageStyle);
      console.log("캔버스:", `${canvas.width}x${canvas.height}`);
      console.log("");

      // 파이프라인 실행
      console.log("에셋 생성 중... (이미지 + TTS 병렬 처리)");
      const result = await runPipeline(scriptPath, config);

      if (!result.ok) {
        console.error(`\n오류 [${result.error.code}]: ${result.error.message}`);
        process.exit(1);
        return;
      }

      const { projectPath, sceneCount, totalDuration } = result.data;
      const durationSec = Math.round(totalDuration / MICROSECONDS_PER_SECOND);
      const minutes = Math.floor(durationSec / 60);
      const seconds = durationSec % 60;

      console.log("\nCapCut 프로젝트 생성 완료!");
      console.log(`  장면 수: ${sceneCount}개`);
      console.log(`  총 길이: ${minutes}분 ${seconds}초`);
      console.log(`  경로: ${projectPath}`);
      console.log("\n  → CapCut을 열어 프로젝트를 확인하세요");
    },
  );

// ─── init 명령어 ───
program
  .command("init")
  .description("설정 파일(.cutflowrc) 생성")
  .action(async () => {
    const rcPath = join(process.cwd(), ".cutflowrc");
    const capCutDir = getCapCutProjectsDir();

    const config = {
      xaiApiKey: process.env.XAI_API_KEY || "",
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
      // 홈 디렉토리에서 시도
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
      // 전체 설정 표시 (API 키는 마스킹)
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
      // 키 값 조회
      const v = config[key];
      console.log(
        v !== undefined ? `${key}: ${v}` : `${key}를 찾을 수 없습니다.`,
      );
      return;
    }

    // 키 값 설정
    config[key] = value;
    await writeFile(rcPath, JSON.stringify(config, null, 2), "utf-8");
    console.log(`${key} = ${value} (저장됨)`);
  });

program.parse();
