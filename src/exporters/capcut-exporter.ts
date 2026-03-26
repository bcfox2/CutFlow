import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { platform } from "node:os";
import type { Timeline, TimelineSegment } from "../types/index.js";
import {
  CAPCUT_VERSION,
  CAPCUT_NEW_VERSION,
  DEFAULT_FPS,
} from "../types/index.js";

interface ExportOptions {
  outputDir: string;
  projectName: string;
}

// 세그먼트당 보조 Material (7개)
function createAuxMaterials() {
  const speedId = randomUUID();
  const placeholderId = randomUUID();
  const canvasId = randomUUID();
  const animationId = randomUUID();
  const soundChannelId = randomUUID();
  const materialColorId = randomUUID();
  const vocalSepId = randomUUID();

  const refs = [
    speedId,
    placeholderId,
    canvasId,
    animationId,
    soundChannelId,
    materialColorId,
    vocalSepId,
  ];

  const materials = {
    speed: {
      id: speedId,
      type: "speed",
      mode: 0,
      speed: 1.0,
      curve_speed: null,
    },
    placeholder: {
      id: placeholderId,
      type: "placeholder_info",
      meta_type: "none",
      res_path: "",
      res_text: "",
      error_path: "",
      error_text: "",
    },
    canvas: {
      id: canvasId,
      type: "canvas_color",
      color: "",
      blur: 0.0,
      image: "",
      album_image: "",
      image_id: "",
      image_name: "",
      source_platform: 0,
      team_id: "",
    },
    animation: {
      id: animationId,
      type: "sticker_animation",
      animations: [],
      multi_language_current: "none",
    },
    soundChannel: {
      id: soundChannelId,
      type: "none",
      audio_channel_mapping: 0,
      is_config_open: false,
    },
    materialColor: {
      id: materialColorId,
      is_color_clip: false,
      is_gradient: false,
      solid_color: "",
      gradient_colors: [],
      gradient_percents: [],
      gradient_angle: 90.0,
      width: 0.0,
      height: 0.0,
    },
    vocalSep: {
      id: vocalSepId,
      type: "vocal_separation",
      choice: 0,
      removed_sounds: [],
      time_range: null,
      production_path: "",
      final_algorithm: "",
      enter_from: "",
    },
  };

  return { refs, materials };
}

// 기본 세그먼트 속성 (실제 CapCut 파일에서 추출)
function defaultSegmentProps() {
  return {
    state: 0,
    speed: 1.0,
    is_loop: false,
    is_tone_modify: false,
    reverse: false,
    intensifies_audio: false,
    cartoon: false,
    volume: 1.0,
    last_nonzero_volume: 1.0,
    clip: {
      scale: { x: 1.0, y: 1.0 },
      rotation: 0.0,
      transform: { x: 0.0, y: 0.0 },
      flip: { vertical: false, horizontal: false },
      alpha: 1.0,
    },
    uniform_scale: { on: true, value: 1.0 },
    render_index: 0,
    keyframe_refs: [],
    enable_lut: true,
    enable_adjust: true,
    enable_hsl: false,
    visible: true,
    group_id: "",
    enable_color_curves: true,
    enable_hsl_curves: true,
    track_render_index: 0,
    hdr_settings: { mode: 1, intensity: 1.0, nits: 1000 },
    enable_color_wheels: true,
    track_attribute: 0,
    is_placeholder: false,
    template_id: "",
    enable_smart_color_adjust: false,
    template_scene: "default",
    common_keyframes: [],
    caption_info: null,
    responsive_layout: {
      enable: false,
      target_follow: "",
      size_layout: 0,
      horizontal_pos_layout: 0,
      vertical_pos_layout: 0,
    },
    enable_color_match_adjust: false,
    enable_color_correct_adjust: false,
    enable_adjust_mask: false,
    raw_segment_id: "",
    lyric_keyframes: null,
    enable_video_mask: true,
    digital_human_template_group_id: "",
    color_correct_alg_result: "",
    source: "segmentsourcenormal",
    enable_mask_stroke: false,
    enable_mask_shadow: false,
  };
}

// 비디오 Material 기본 속성
function defaultVideoMaterial(
  id: string,
  path: string,
  duration: number,
  width: number,
  height: number,
) {
  return {
    id,
    type: "photo",
    duration,
    path,
    media_path: "",
    local_id: "",
    has_audio: false,
    reverse_path: "",
    intensifies_path: "",
    reverse_intensifies_path: "",
    intensifies_audio_path: "",
    cartoon_path: "",
    width,
    height,
    category_id: "",
    category_name: "local",
    material_id: "",
    material_name: "",
    material_url: "",
    crop: {
      upper_left_x: 0,
      upper_left_y: 0,
      upper_right_x: 1,
      upper_right_y: 0,
      lower_left_x: 0,
      lower_left_y: 1,
      lower_right_x: 1,
      lower_right_y: 1,
    },
    crop_ratio: "free",
    audio_fade: null,
    crop_scale: 1.0,
    extra_type_option: 0,
    stable: {
      stable_level: 0,
      matrix_path: "",
      time_range: { start: 0, duration: 0 },
    },
    matting: {
      flag: 0,
      path: "",
      interactiveTime: [],
      has_use_quick_brush: false,
      strokes: [],
      has_use_quick_eraser: false,
      expansion: 0,
      feather: 0,
      reverse: false,
      custom_matting_id: "",
      enable_matting_stroke: false,
    },
    source: 0,
    source_platform: 0,
    formula_id: "",
    check_flag: 62978047,
    video_algorithm: {
      algorithms: [],
      time_range: null,
      path: "",
      gameplay_configs: [],
      ai_in_painting_config: [],
      complement_frame_config: null,
      motion_blur_config: null,
      deflicker: null,
      noise_reduction: null,
      quality_enhance: null,
      super_resolution: null,
      ai_background_configs: [],
      smart_complement_frame: null,
      aigc_generate: null,
      aigc_generate_list: [],
      mouth_shape_driver: null,
      ai_expression_driven: null,
      ai_motion_driven: null,
      image_interpretation: null,
      story_video_modify_video_config: {
        task_id: "",
        is_overwrite_last_video: false,
        tracker_task_id: "",
      },
      skip_algorithm_index: [],
    },
    is_unified_beauty_mode: false,
    object_locked: null,
    smart_motion: null,
    multi_camera_info: null,
    freeze: null,
    picture_from: "none",
    picture_set_category_id: "",
    picture_set_category_name: "",
    team_id: "",
    local_material_id: "",
    origin_material_id: "",
    request_id: "",
    has_sound_separated: false,
    is_text_edit_overdub: false,
    is_ai_generate_content: false,
    aigc_type: "none",
    is_copyright: false,
    aigc_history_id: "",
    aigc_item_id: "",
    local_material_from: "",
    smart_match_info: null,
    beauty_face_preset_infos: [],
    beauty_body_preset_id: "",
    beauty_face_auto_preset: {
      preset_id: "",
      name: "",
      rate_map: "",
      scene: "",
    },
    beauty_face_auto_preset_infos: [],
    beauty_body_auto_preset: null,
    live_photo_timestamp: -1,
    live_photo_cover_path: "",
    content_feature_info: null,
    corner_pin: null,
    surface_trackings: [],
    video_mask_stroke: {
      resource_id: "",
      path: "",
      type: "",
      color: "",
      size: 0,
      alpha: 0,
      distance: 0,
      texture: 0,
      horizontal_shift: 0,
      vertical_shift: 0,
    },
    video_mask_shadow: {
      resource_id: "",
      path: "",
      color: "",
      alpha: 0,
      blur: 0,
      distance: 0,
      angle: 0,
    },
  };
}

// 오디오 Material
function defaultAudioMaterial(id: string, path: string, duration: number) {
  return {
    id,
    type: "extract_music",
    duration,
    path,
    local_id: "",
    category_id: "",
    category_name: "local",
    material_id: "",
    material_name: "",
    material_url: "",
    source_platform: 0,
    team_id: "",
    music_id: "",
    request_id: "",
    audio_fade: null,
  };
}

// 텍스트 Material
function defaultTextMaterial(id: string, text: string) {
  return {
    id,
    content: JSON.stringify({
      styles: [
        {
          fill: { content: { solid: { color: [1, 1, 1, 1] } } },
          font: { id: "", path: "" },
          range: [0, text.length],
          size: 8.0,
          strokes: [
            { content: { solid: { color: [0, 0, 0, 1] } }, width: 0.04 },
          ],
        },
      ],
      text,
    }),
    alignment: 1,
    caption_template_info: {
      category_id: "",
      category_name: "",
      effect_id: "",
      is_new_flag: false,
      path: "",
      request_id: "",
      resource_id: "",
      resource_name: "",
      source_platform: 0,
    },
    check_flag: 7,
    fixed_height: -1,
    fixed_width: -1,
    font_category_id: "",
    font_category_name: "",
    font_id: "",
    font_name: "",
    font_path: "",
    font_resource_id: "",
    font_size: 8.0,
    font_source_platform: 0,
    font_team_id: "",
    font_title: "",
    font_url: "",
    fonts: [],
    force_apply_line_max_width: false,
    global_alpha: 1.0,
    has_shadow: false,
    is_rich_text: false,
    italic_degree: 0,
    ktv_color: "",
    language: "",
    layer_weight: 1,
    letter_spacing: 0.1,
    line_feed: 1,
    line_max_width: 0.82,
    line_spacing: 0.02,
    multi_language_current: "none",
    original_size: [],
    preset_category: "",
    preset_category_id: "",
    preset_has_set_alignment: false,
    preset_id: "",
    preset_index: 0,
    preset_name: "",
    recognize_task_id: "",
    recognize_type: 0,
    relevance_segment: [],
    shadow_alpha: 0.9,
    shadow_angle: -45,
    shadow_color: "",
    shadow_distance: 8,
    shadow_point: { x: 0.6401844024658203, y: 0.6401844024658203 },
    shadow_smoothing: 4,
    shape_clip_x: false,
    shape_clip_y: false,
    style_name: "",
    sub_type: 0,
    subtitle_keywords: null,
    text_alpha: 1,
    text_color: "#FFFFFF",
    text_curve: null,
    text_preset_resource_id: "",
    text_size: 30,
    text_to_audio_ids: [],
    tts_auto_update: false,
    type: "subtitle",
    typesetting: 0,
    underline: false,
    underline_offset: 0.22,
    underline_width: 0.05,
    use_effect_default_color: true,
    words: { end_time: [], start_time: [], text: [] },
  };
}

// CapCut draft_content.json 생성 + 프로젝트 폴더 구조
export async function exportCapCut(
  timeline: Timeline,
  options: ExportOptions,
): Promise<{ projectPath: string }> {
  const projectId = randomUUID().toUpperCase();
  const draftFolderId = randomUUID().toUpperCase();
  const projectPath = join(options.outputDir, projectId);
  const materialDir = join(projectPath, "ai_material");

  // 폴더 생성
  await mkdir(materialDir, { recursive: true });

  // 미디어 파일 복사 + 경로 맵 구축
  const pathPrefix = `##_draftpath_placeholder_${draftFolderId}_##`;
  const allVideoMaterials: ReturnType<typeof defaultVideoMaterial>[] = [];
  const allAudioMaterials: ReturnType<typeof defaultAudioMaterial>[] = [];
  const allTextMaterials: ReturnType<typeof defaultTextMaterial>[] = [];
  const allSpeeds: ReturnType<
    typeof createAuxMaterials
  >["materials"]["speed"][] = [];
  const allCanvases: ReturnType<
    typeof createAuxMaterials
  >["materials"]["canvas"][] = [];
  const allAnimations: ReturnType<
    typeof createAuxMaterials
  >["materials"]["animation"][] = [];
  const allPlaceholders: ReturnType<
    typeof createAuxMaterials
  >["materials"]["placeholder"][] = [];
  const allSoundChannels: ReturnType<
    typeof createAuxMaterials
  >["materials"]["soundChannel"][] = [];
  const allMaterialColors: ReturnType<
    typeof createAuxMaterials
  >["materials"]["materialColor"][] = [];
  const allVocalSeps: ReturnType<
    typeof createAuxMaterials
  >["materials"]["vocalSep"][] = [];

  const tracks: Record<string, unknown>[] = [];

  // 비디오 트랙
  const videoSegments: Record<string, unknown>[] = [];
  for (const seg of timeline.videoTrack) {
    if (seg.filePath) {
      const fileName = basename(seg.filePath);
      const destPath = join(materialDir, fileName);
      try {
        await copyFile(seg.filePath, destPath);
      } catch {
        /* 파일 없으면 스킵 */
      }
      const materialPath = `${pathPrefix}/ai_material/${fileName}`;
      const mat = defaultVideoMaterial(
        seg.materialId,
        materialPath,
        seg.duration,
        timeline.canvas.width,
        timeline.canvas.height,
      );
      allVideoMaterials.push(mat);

      const aux = createAuxMaterials();
      allSpeeds.push(aux.materials.speed);
      allCanvases.push(aux.materials.canvas);
      allAnimations.push(aux.materials.animation);
      allPlaceholders.push(aux.materials.placeholder);
      allSoundChannels.push(aux.materials.soundChannel);
      allMaterialColors.push(aux.materials.materialColor);
      allVocalSeps.push(aux.materials.vocalSep);

      videoSegments.push({
        id: randomUUID().toUpperCase(),
        material_id: seg.materialId,
        extra_material_refs: aux.refs,
        source_timerange: { start: 0, duration: seg.duration },
        target_timerange: { start: seg.start, duration: seg.duration },
        render_timerange: { start: 0, duration: 0 },
        ...defaultSegmentProps(),
      });
    }
  }

  if (videoSegments.length > 0) {
    tracks.push({
      id: randomUUID().toUpperCase(),
      type: "video",
      attribute: 0,
      flag: 0,
      is_default_name: true,
      name: "",
      segments: videoSegments,
    });
  }

  // 오디오 트랙
  const audioSegments: Record<string, unknown>[] = [];
  for (const seg of timeline.audioTrack) {
    if (seg.filePath) {
      const fileName = basename(seg.filePath);
      const destPath = join(materialDir, fileName);
      try {
        await copyFile(seg.filePath, destPath);
      } catch {
        /* 스킵 */
      }
      const materialPath = `${pathPrefix}/ai_material/${fileName}`;
      const mat = defaultAudioMaterial(
        seg.materialId,
        materialPath,
        seg.duration,
      );
      allAudioMaterials.push(mat);

      const aux = createAuxMaterials();
      allSpeeds.push(aux.materials.speed);
      allPlaceholders.push(aux.materials.placeholder);
      allSoundChannels.push(aux.materials.soundChannel);

      audioSegments.push({
        id: randomUUID().toUpperCase(),
        material_id: seg.materialId,
        extra_material_refs: [
          aux.materials.speed.id,
          aux.materials.placeholder.id,
          aux.materials.soundChannel.id,
        ],
        source_timerange: { start: 0, duration: seg.duration },
        target_timerange: { start: seg.start, duration: seg.duration },
        render_timerange: { start: 0, duration: 0 },
        ...defaultSegmentProps(),
      });
    }
  }

  if (audioSegments.length > 0) {
    tracks.push({
      id: randomUUID().toUpperCase(),
      type: "audio",
      attribute: 0,
      flag: 0,
      is_default_name: true,
      name: "",
      segments: audioSegments,
    });
  }

  // 텍스트 트랙
  const textSegments: Record<string, unknown>[] = [];
  for (const seg of timeline.textTrack) {
    if (seg.text) {
      const mat = defaultTextMaterial(seg.materialId, seg.text);
      allTextMaterials.push(mat);

      textSegments.push({
        id: randomUUID().toUpperCase(),
        material_id: seg.materialId,
        extra_material_refs: [],
        source_timerange: { start: 0, duration: seg.duration },
        target_timerange: { start: seg.start, duration: seg.duration },
        render_timerange: { start: 0, duration: 0 },
        ...defaultSegmentProps(),
      });
    }
  }

  if (textSegments.length > 0) {
    tracks.push({
      id: randomUUID().toUpperCase(),
      type: "text",
      attribute: 0,
      flag: 0,
      is_default_name: true,
      name: "",
      segments: textSegments,
    });
  }

  // draft_content.json 조립
  const draftContent = {
    id: projectId,
    version: CAPCUT_VERSION,
    new_version: CAPCUT_NEW_VERSION,
    name: options.projectName || "",
    duration: timeline.totalDuration,
    create_time: 0,
    update_time: 0,
    fps: DEFAULT_FPS,
    is_drop_frame_timecode: false,
    color_space: -1,
    config: {
      video_mute: false,
      record_audio_last_index: 1,
      extract_audio_last_index: 1,
      original_sound_last_index: 1,
      subtitle_recognition_id: "",
      subtitle_taskinfo: [],
      lyrics_recognition_id: "",
      lyrics_taskinfo: [],
      subtitle_sync: true,
      lyrics_sync: true,
      sticker_max_index: 1,
      adjust_max_index: 1,
      material_save_mode: 0,
      export_range: null,
      maintrack_adsorb: true,
      combination_max_index: 1,
      attachment_info: [],
      zoom_info_params: null,
      system_font_list: [],
      multi_language_mode: "none",
      multi_language_main: "none",
      multi_language_current: "none",
      multi_language_list: [],
      subtitle_keywords_config: null,
      use_float_render: false,
    },
    canvas_config: {
      ratio: "original",
      width: timeline.canvas.width,
      height: timeline.canvas.height,
      background: null,
    },
    tracks,
    group_container: null,
    materials: {
      videos: allVideoMaterials,
      audios: allAudioMaterials,
      images: [],
      texts: allTextMaterials,
      effects: [],
      stickers: [],
      canvases: allCanvases,
      transitions: [],
      audio_effects: [],
      audio_fades: [],
      beats: [],
      flowers: [],
      material_animations: allAnimations,
      placeholders: [],
      placeholder_infos: allPlaceholders,
      speeds: allSpeeds,
      common_mask: [],
      chromas: [],
      text_templates: [],
      realtime_denoises: [],
      audio_pannings: [],
      audio_pitch_shifts: [],
      video_trackings: [],
      hsl: [],
      drafts: [],
      color_curves: [],
      hsl_curves: [],
      primary_color_wheels: [],
      log_color_wheels: [],
      video_effects: [],
      audio_balances: [],
      handwrites: [],
      manual_deformations: [],
      manual_beautys: [],
      plugin_effects: [],
      sound_channel_mappings: allSoundChannels,
      green_screens: [],
      shapes: [],
      material_colors: allMaterialColors,
      digital_humans: [],
      digital_human_model_dressing: [],
      smart_crops: [],
      ai_translates: [],
      audio_track_indexes: [],
      loudnesses: [],
      vocal_beautifys: [],
      vocal_separations: allVocalSeps,
      smart_relights: [],
      time_marks: [],
      multi_language_refs: [],
      video_shadows: [],
      video_strokes: [],
      video_radius: [],
      tail_leaders: [],
    },
    keyframes: {
      videos: [],
      audios: [],
      texts: [],
      stickers: [],
      filters: [],
      adjusts: [],
      handwrites: [],
      effects: [],
    },
    keyframe_graph_list: [],
    platform: {
      os: platform() === "win32" ? "windows" : "mac",
      os_version: "",
      app_id: 359289,
      app_version: "7.5.0",
      app_source: "cc",
      device_id: "",
      hard_disk_id: "",
      mac_address: "",
    },
    last_modified_platform: {
      os: platform() === "win32" ? "windows" : "mac",
      os_version: "",
      app_id: 359289,
      app_version: "7.5.0",
      app_source: "cc",
      device_id: "",
      hard_disk_id: "",
      mac_address: "",
    },
    mutable_config: null,
    cover: null,
    retouch_cover: null,
    extra_info: null,
    relationships: [],
    render_index_track_mode_on: true,
    free_render_index_mode_on: false,
    static_cover_image_path: "",
    source: "default",
    time_marks: null,
    path: "",
    lyrics_effects: [],
    draft_type: "video",
  };

  // 파일 쓰기
  await writeFile(
    join(projectPath, "draft_content.json"),
    JSON.stringify(draftContent),
    "utf-8",
  );
  await writeFile(join(projectPath, "draft_meta_info.json"), "{}", "utf-8");
  await writeFile(join(projectPath, "draft_biz_config.json"), "", "utf-8");
  await writeFile(
    join(projectPath, "draft_agency_config.json"),
    JSON.stringify({
      is_auto_agency_enabled: false,
      is_auto_agency_popup: false,
      is_single_agency_mode: false,
      marterials: null,
      use_converter: false,
      video_resolution: 720,
    }),
    "utf-8",
  );

  return { projectPath };
}
