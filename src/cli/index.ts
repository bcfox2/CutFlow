import { Command } from "commander";
import { loadConfig } from "../config/config.js";
import { runPipeline } from "../pipeline.js";
import { MICROSECONDS_PER_SECOND } from "../types/index.js";

const program = new Command();

program
  .name("cutflow")
  .description("대본만 넣으면 CapCut 프로젝트 파일로 완성하는 CLI 도구")
  .version("0.1.0");

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
  .action(async (scriptPath: string, opts: Record<string, string>) => {
    console.log("CutFlow - CapCut 프로젝트 생성기\n");

    // 캔버스 파싱
    const canvasParts = (opts.canvas || "1920x1080").split("x").map(Number);
    const canvas = {
      width: canvasParts[0] || 1920,
      height: canvasParts[1] || 1080,
      ratio: "original",
    };

    // 설정 로드
    const configResult = await loadConfig({
      outputDir: opts.output,
      projectName: opts.name,
      elevenLabsVoiceId: opts.voice,
      imageStyle: opts.style,
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
  });

program.parse();
