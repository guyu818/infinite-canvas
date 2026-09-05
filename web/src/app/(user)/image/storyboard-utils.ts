export type StoryboardGrid = "auto" | "1x2" | "1x3" | "2x2" | "2x3" | "3x3";
export type StoryboardAspect = "16:9" | "9:16" | "1:1";
export type StoryboardFit = "contain" | "cover";

export type StoryboardFrame = {
    id: string;
    title: string;
    dataUrl: string;
};

const aspectRatios: Record<StoryboardAspect, number> = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1 };

export function buildStoryboardPrompt({ script, grid, aspect, style }: { script: string; grid: Exclude<StoryboardGrid, "auto">; aspect: StoryboardAspect; style: string }) {
    const [rows, columns] = grid.split("x");
    return [
        `生成一张 ${rows}×${columns} 故事板分镜拼图，共 ${Number(columns) * Number(rows)} 个等尺寸面板。`,
        `每个面板按 ${aspect} 构图，严格从左到右、从上到下推进剧情。`,
        `视觉风格：${style}。所有面板保持角色身份、服装、道具、场景、时间、光线和调色连续一致。`,
        "相邻面板使用细、纯黑、不透明分隔线，整张拼图有同样的细黑外框。每格左上角只放一个小号白字黑底数字编号，除此之外不要标题、字幕、对白文字、参数、水印或乱码。",
        "镜头应覆盖建立镜头、动作发展、关键细节或反应、情绪/动作落点；不得增加原文没有的剧情。",
        `剧本或镜头内容：\n${script.trim()}`,
    ].join("\n\n");
}

export async function composeStoryboard({ frames, grid, aspect, fit, showNumbers }: { frames: StoryboardFrame[]; grid: StoryboardGrid; aspect: StoryboardAspect; fit: StoryboardFit; showNumbers: boolean }) {
    if (!frames.length) throw new Error("请先添加分镜图片");
    const columns = resolveColumns(grid, frames.length);
    const rows = Math.ceil(frames.length / columns);
    const ratio = aspectRatios[aspect];
    const gap = 8;
    let panelWidth = aspect === "9:16" ? 640 : 960;
    let panelHeight = Math.round(panelWidth / ratio);
    const maxSide = 4096;
    const scale = Math.min(1, (maxSide - gap * (columns + 1)) / (panelWidth * columns), (maxSide - gap * (rows + 1)) / (panelHeight * rows));
    panelWidth = Math.max(160, Math.floor(panelWidth * scale));
    panelHeight = Math.max(160, Math.floor(panelHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = panelWidth * columns + gap * (columns + 1);
    canvas.height = panelHeight * rows + gap * (rows + 1);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法创建故事板");
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const images = await Promise.all(frames.map((frame) => loadImage(frame.dataUrl)));
    images.forEach((image, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = gap + column * (panelWidth + gap);
        const y = gap + row * (panelHeight + gap);
        drawImage(context, image, x, y, panelWidth, panelHeight, fit);
        if (showNumbers) drawNumber(context, index + 1, x, y, panelWidth, panelHeight);
    });

    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, columns, rows };
}

function resolveColumns(grid: StoryboardGrid, count: number) {
    if (grid !== "auto") return Number(grid.split("x")[1]);
    if (count <= 3) return count;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("有分镜图片无法读取，请重新添加"));
        image.src = src;
    });
}

function drawImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, fit: StoryboardFit) {
    const scale = fit === "cover" ? Math.max(width / image.naturalWidth, height / image.naturalHeight) : Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = image.naturalWidth * scale;
    const sourceHeight = image.naturalHeight * scale;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = "#111111";
    context.fillRect(x, y, width, height);
    context.drawImage(image, x + (width - sourceWidth) / 2, y + (height - sourceHeight) / 2, sourceWidth, sourceHeight);
    context.restore();
}

function drawNumber(context: CanvasRenderingContext2D, number: number, x: number, y: number, width: number, height: number) {
    const size = Math.max(22, Math.min(48, Math.round(Math.min(width, height) * 0.08)));
    const padding = Math.max(6, Math.round(size * 0.28));
    context.fillStyle = "rgba(0,0,0,.86)";
    context.fillRect(x + padding, y + padding, size, size);
    context.fillStyle = "#ffffff";
    context.font = `700 ${Math.round(size * 0.52)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(number), x + padding + size / 2, y + padding + size / 2);
}
