"use client";

import { ArrowDown, ArrowUp, Download, Film, ImagePlus, LayoutGrid, LoaderCircle, Play, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { App, Button, Checkbox, Empty, Input, Segmented, Select, Tag } from "antd";
import { nanoid } from "nanoid";

import { buildStoryboardPrompt, composeStoryboard, type StoryboardAspect, type StoryboardFit, type StoryboardFrame, type StoryboardGrid } from "./storyboard-utils";

export type StoryboardCandidate = { id: string; title: string; previewUrl: string };

const styleOptions = ["写实电影静帧", "铅笔与墨线分镜", "数字概念绘画"];
const generateGridOptions = [
    { value: "2x2", label: "2×2 · 4格" },
    { value: "2x3", label: "2×3 · 6格" },
    { value: "3x3", label: "3×3 · 9格" },
];
const stitchGridOptions = [
    { value: "auto", label: "自动" },
    { value: "1x2", label: "横排2格" },
    { value: "1x3", label: "横排3格" },
    ...generateGridOptions,
];

export function StoryboardStudio({ candidates, onResolveCandidate, onApplyPrompt, onGenerate, onUseCollage }: { candidates: StoryboardCandidate[]; onResolveCandidate: (id: string) => Promise<string>; onApplyPrompt: (prompt: string) => void; onGenerate: (prompt: string) => Promise<boolean>; onUseCollage: (dataUrl: string, width: number, height: number) => Promise<void> }) {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<"generate" | "stitch">("generate");
    const [script, setScript] = useState("");
    const [generateGrid, setGenerateGrid] = useState<"2x2" | "2x3" | "3x3">("2x2");
    const [aspect, setAspect] = useState<StoryboardAspect>("16:9");
    const [style, setStyle] = useState(styleOptions[0]);
    const [generating, setGenerating] = useState(false);
    const [frames, setFrames] = useState<StoryboardFrame[]>([]);
    const [stitchGrid, setStitchGrid] = useState<StoryboardGrid>("auto");
    const [fit, setFit] = useState<StoryboardFit>("contain");
    const [showNumbers, setShowNumbers] = useState(true);
    const [composing, setComposing] = useState(false);
    const [addingCandidateId, setAddingCandidateId] = useState("");
    const [collage, setCollage] = useState<{ dataUrl: string; width: number; height: number; columns: number; rows: number } | null>(null);

    const makePrompt = () => {
        if (!script.trim()) {
            message.warning("请先输入剧本或镜头内容");
            return null;
        }
        return buildStoryboardPrompt({ script, grid: generateGrid, aspect, style });
    };

    const applyPrompt = () => {
        const prompt = makePrompt();
        if (prompt) onApplyPrompt(prompt);
    };

    const generate = async () => {
        const prompt = makePrompt();
        if (!prompt) return;
        setGenerating(true);
        try {
            await onGenerate(prompt);
        } finally {
            setGenerating(false);
        }
    };

    const addFiles = async (files: FileList | null) => {
        const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
        if (!imageFiles.length) return;
        const next = await Promise.all(imageFiles.map(async (file) => ({ id: nanoid(), title: file.name, dataUrl: await readFile(file) })));
        setFrames((value) => [...value, ...next]);
        setCollage(null);
    };

    const addCandidate = async (candidate: StoryboardCandidate) => {
        setAddingCandidateId(candidate.id);
        try {
            const dataUrl = await onResolveCandidate(candidate.id);
            setFrames((value) => [...value, { id: nanoid(), title: candidate.title, dataUrl }]);
            setCollage(null);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "图片读取失败");
        } finally {
            setAddingCandidateId("");
        }
    };

    const moveFrame = (index: number, offset: number) => {
        const target = index + offset;
        if (target < 0 || target >= frames.length) return;
        setFrames((value) => {
            const next = [...value];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
        setCollage(null);
    };

    const compose = async () => {
        setComposing(true);
        try {
            const result = await composeStoryboard({ frames, grid: stitchGrid, aspect, fit, showNumbers });
            setCollage(result);
            message.success(`已拼接为 ${result.rows}×${result.columns} 故事板`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "故事板拼接失败");
        } finally {
            setComposing(false);
        }
    };

    const download = () => {
        if (!collage) return;
        const link = document.createElement("a");
        link.href = collage.dataUrl;
        link.download = `storyboard-${collage.rows}x${collage.columns}.png`;
        link.click();
    };

    return (
        <div className="min-h-full bg-stone-50 text-stone-950 dark:bg-stone-950 dark:text-stone-100">
            <div className="border-b border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-lg font-semibold"><Film className="size-5" />故事板工作台</div>
                        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">从剧本直接生成整张故事板，或把单张分镜按镜头顺序拼接。</p>
                    </div>
                    <Segmented value={mode} onChange={(value) => setMode(value as typeof mode)} options={[{ value: "generate", label: "AI 生成故事板", icon: <ImagePlus className="size-4" /> }, { value: "stitch", label: "拼接单张分镜", icon: <LayoutGrid className="size-4" /> }]} />
                </div>
            </div>

            {mode === "generate" ? (
                <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                        <div className="mb-2 flex items-center justify-between"><span className="font-medium">剧本 / 镜头内容</span><Tag className="m-0">一步生成整张拼图</Tag></div>
                        <Input.TextArea value={script} onChange={(event) => setScript(event.target.value)} autoSize={{ minRows: 14, maxRows: 24 }} placeholder="粘贴剧本、分镜描述或故事梗概。系统会按阅读顺序分配到每个面板，并保持角色与场景连续。" />
                    </section>
                    <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                        <Field label="故事板布局"><Select className="w-full" value={generateGrid} options={generateGridOptions} onChange={setGenerateGrid} /></Field>
                        <Field label="单格画幅"><Segmented block value={aspect} onChange={(value) => setAspect(value as StoryboardAspect)} options={["16:9", "9:16", "1:1"]} /></Field>
                        <Field label="视觉风格"><Select className="w-full" value={style} options={styleOptions.map((value) => ({ value, label: value }))} onChange={setStyle} /></Field>
                        <div className="rounded-lg bg-stone-100 p-3 text-xs leading-6 text-stone-600 dark:bg-stone-950 dark:text-stone-400">生成结果是一张带黑色分隔线与镜头编号的复合图。当前工作台中的参考图会继续用于角色、产品和场景一致性。</div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button onClick={applyPrompt}>填入主工作台</Button>
                            <Button type="primary" icon={<Play className="size-4" />} loading={generating} onClick={() => void generate()}>直接生成</Button>
                        </div>
                    </section>
                </div>
            ) : (
                <div className="grid gap-5 p-5 xl:grid-cols-[minmax(360px,.8fr)_minmax(0,1.2fr)]">
                    <div className="space-y-4">
                        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="font-medium">镜头顺序</div><div className="text-xs text-stone-500">按从左到右、从上到下排列</div></div><Button icon={<Upload className="size-4" />} onClick={() => fileInputRef.current?.click()}>上传多张</Button></div>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
                            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                                {frames.map((frame, index) => (
                                    <div key={frame.id} className="flex items-center gap-3 rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                                        <img src={frame.dataUrl} alt="" className="h-12 w-20 rounded object-cover" />
                                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{index + 1}. {frame.title}</div></div>
                                        <Button type="text" size="small" disabled={!index} icon={<ArrowUp className="size-4" />} onClick={() => moveFrame(index, -1)} />
                                        <Button type="text" size="small" disabled={index === frames.length - 1} icon={<ArrowDown className="size-4" />} onClick={() => moveFrame(index, 1)} />
                                        <Button danger type="text" size="small" icon={<Trash2 className="size-4" />} onClick={() => { setFrames((value) => value.filter((item) => item.id !== frame.id)); setCollage(null); }} />
                                    </div>
                                ))}
                                {!frames.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="上传图片，或从最近生成中添加" /> : null}
                            </div>
                        </section>

                        {candidates.length ? <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"><div className="mb-3 font-medium">最近生成</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{candidates.slice(0, 12).map((candidate) => <button key={candidate.id} type="button" className="group relative aspect-video overflow-hidden rounded-lg border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-950" onClick={() => void addCandidate(candidate)}><img src={candidate.previewUrl} alt={candidate.title} className="size-full object-cover transition group-hover:scale-105" /><span className="absolute inset-0 grid place-items-center bg-black/0 text-white transition group-hover:bg-black/35">{addingCandidateId === candidate.id ? <LoaderCircle className="size-5 animate-spin" /> : <Plus className="size-5 opacity-0 group-hover:opacity-100" />}</span></button>)}</div></section> : null}
                    </div>

                    <section className="flex min-h-[520px] flex-col rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                        <div className="grid gap-3 md:grid-cols-3">
                            <Field label="拼接布局"><Select className="w-full" value={stitchGrid} options={stitchGridOptions} onChange={(value) => { setStitchGrid(value); setCollage(null); }} /></Field>
                            <Field label="单格画幅"><Segmented block value={aspect} onChange={(value) => { setAspect(value as StoryboardAspect); setCollage(null); }} options={["16:9", "9:16", "1:1"]} /></Field>
                            <Field label="画面适配"><Segmented block value={fit} onChange={(value) => { setFit(value as StoryboardFit); setCollage(null); }} options={[{ value: "contain", label: "完整显示" }, { value: "cover", label: "填满裁切" }]} /></Field>
                        </div>
                        <Checkbox className="mt-3" checked={showNumbers} onChange={(event) => { setShowNumbers(event.target.checked); setCollage(null); }}>显示镜头编号</Checkbox>
                        <div className="my-4 grid min-h-72 flex-1 place-items-center overflow-hidden rounded-xl bg-stone-950 p-3">
                            {collage ? <img src={collage.dataUrl} alt="故事板预览" className="max-h-[520px] max-w-full object-contain" /> : <div className="text-center text-stone-500"><LayoutGrid className="mx-auto mb-3 size-10" /><div>添加并排序分镜后生成预览</div></div>}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            {collage ? <><Button icon={<Download className="size-4" />} onClick={download}>下载 PNG</Button><Button icon={<Plus className="size-4" />} onClick={() => void onUseCollage(collage.dataUrl, collage.width, collage.height)}>作为参考图继续创作</Button></> : null}
                            <Button type="primary" icon={<LayoutGrid className="size-4" />} loading={composing} disabled={!frames.length} onClick={() => void compose()}>生成拼接预览</Button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="grid gap-1.5 text-sm"><span className="text-xs text-stone-500 dark:text-stone-400">{label}</span>{children}</label>;
}

function readFile(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
        reader.readAsDataURL(file);
    });
}
