import React from "react";
import { useLang, type Lang } from "./lang";

/** The EN / 中文 switch (lang.ts): sets every panel's language at once. */
const LangSwitch: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 11, style }) => {
  const [lang, choose] = useLang();
  const button = (l: Lang, label: string) => (
    <button
      key={l}
      type="button"
      onClick={() => choose(l)}
      style={{
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: size,
        cursor: "pointer",
        background: "transparent",
        border: `1px solid ${lang === l ? "#81dad3" : "#6b7178"}`,
        color: lang === l ? "#81dad3" : "#99a0a8",
      }}
    >
      {label}
    </button>
  );
  return <span style={{ display: "inline-flex", gap: 4, ...style }}>{button("en", "EN")}{button("zh", "中文")}</span>;
};

export default LangSwitch;
