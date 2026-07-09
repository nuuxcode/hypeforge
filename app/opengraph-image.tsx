import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#fbf6ee",
          color: "#141118",
          display: "flex",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ background: "#70e8dd", borderRadius: "999px", height: "28px", left: "72px", position: "absolute", top: "72px", width: "28px" }} />
        <div style={{ background: "#ff6b5f", borderRadius: "999px", bottom: "72px", height: "28px", position: "absolute", right: "72px", width: "28px" }} />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "900px" }}>
          <div style={{ color: "#d946a3", display: "flex", fontSize: "38px", fontWeight: 700 }}>HypeForge</div>
          <div style={{ display: "flex", fontSize: "82px", fontWeight: 800, letterSpacing: "0", lineHeight: 1.05, marginTop: "30px" }}>
            Turn any person into a living legend.
          </div>
          <div style={{ color: "#5b5361", display: "flex", fontSize: "32px", lineHeight: 1.35, marginTop: "30px" }}>
            Three wildly generous AI compliments, ready to share.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
