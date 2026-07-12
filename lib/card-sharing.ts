import { copyTextToClipboard } from "./clipboard";
import type { DeliveryMode, PersonaBucket } from "./types";

export type SharePlatform = "x" | "linkedin" | "whatsapp";

export type ComplimentShareData = {
  text: string;
  jobFunction: string;
  personaName: string;
  bucket: PersonaBucket;
  dramaLevel: number;
  deliveryMode?: DeliveryMode;
};

const PLATFORM_LABEL: Record<SharePlatform, string> = {
  x: "X",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

const CARD_ACCENT: Record<PersonaBucket, string> = {
  grand: "#7050c8",
  mythic: "#168a87",
  chaotic: "#ff6b5f",
};

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sliced = value.slice(0, Math.max(0, maxLength - 1));
  const boundary = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, boundary > maxLength * 0.7 ? boundary : sliced.length).trimEnd()}…`;
}

export function formatComplimentForPlatform(platform: SharePlatform, data: ComplimentShareData): string {
  const text = clean(data.text);
  const role = clean(data.jobFunction);

  if (platform === "x") {
    const suffix = "\n\n#HypeForge";
    if (text.length + suffix.length <= 280) return `${text}${suffix}`;
    return `${truncateAtWord(text, 280 - suffix.length)}${suffix}`;
  }

  if (platform === "linkedin") {
    const lead = data.deliveryMode === "public"
      ? `Celebrating the work of ${role}:`
      : `A little appreciation for ${role}:`;
    return `${lead}\n\n${text}\n\n#EmployeeRecognition #WorkplaceCulture`;
  }

  return `*A HypeForge compliment for ${role}*\n\n${text}\n\n_Made with HypeForge_`;
}

export async function copyComplimentForPlatform(
  platform: SharePlatform,
  data: ComplimentShareData,
): Promise<string> {
  await copyTextToClipboard(formatComplimentForPlatform(platform, data));
  return `Copied for ${PLATFORM_LABEL[platform]}.`;
}

export async function shareComplimentNatively(
  data: ComplimentShareData,
): Promise<"shared" | "copied" | "cancelled"> {
  const text = clean(data.text);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: `${data.personaName} compliment for ${clean(data.jobFunction)}`,
        text,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      console.warn("[HypeForge card share] Native share failed; copying instead.", error);
    }
  }
  await copyTextToClipboard(text);
  return "copied";
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = clean(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createComplimentPng(data: ComplimentShareData): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("PNG export is only available in a browser.");
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create the compliment image.");

  const accent = CARD_ACCENT[data.bucket];
  context.fillStyle = "#f4f4f8";
  context.fillRect(0, 0, canvas.width, canvas.height);

  roundedRect(context, 72, 72, 1056, 1056, 44);
  context.fillStyle = "#ffffff";
  context.fill();
  context.strokeStyle = "#d9d9e2";
  context.lineWidth = 3;
  context.stroke();

  context.save();
  roundedRect(context, 72, 72, 1056, 1056, 44);
  context.clip();
  context.fillStyle = accent;
  context.fillRect(72, 72, 1056, 12);
  context.restore();

  context.fillStyle = accent;
  context.font = "700 27px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("✦ HYPEFORGE", 122, 154);

  context.fillStyle = "#6e6e73";
  context.font = "700 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`${data.bucket.toUpperCase()} VOICE · DRAMA ${String(data.dramaLevel).padStart(2, "0")}`, 122, 220);

  context.fillStyle = "#1d1d1f";
  context.font = "700 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText(clean(data.personaName), 122, 284);

  const maxTextWidth = 956;
  let fontSize = 51;
  let lines: string[] = [];
  do {
    context.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    lines = wrapLines(context, data.text, maxTextWidth);
    if (lines.length <= 9) break;
    fontSize -= 2;
  } while (fontSize > 39);

  context.fillStyle = "#1d1d1f";
  const lineHeight = Math.round(fontSize * 1.34);
  lines.forEach((line, index) => context.fillText(line, 122, 382 + index * lineHeight));

  const footerY = 1038;
  context.strokeStyle = "#e2e2e8";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(122, footerY - 58);
  context.lineTo(1078, footerY - 58);
  context.stroke();

  context.fillStyle = "#446100";
  context.font = "700 24px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText("✓ 8/8 company guidelines", 122, footerY);
  context.fillStyle = "#6e6e73";
  context.textAlign = "right";
  context.fillText(truncateAtWord(clean(data.jobFunction), 52), 1078, footerY);
  context.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the compliment image."));
    }, "image/png");
  });
}

export async function downloadComplimentPng(data: ComplimentShareData): Promise<void> {
  const blob = await createComplimentPng(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeRole = clean(data.jobFunction).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/g, "");
  link.href = url;
  link.download = `hypeforge-${safeRole || "compliment"}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
