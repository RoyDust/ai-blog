import localFont from "next/font/local";
import { Noto_Serif_SC } from "next/font/google";

export const alibabaPuHuiTi = localFont({
  src: [
    {
      path: "../../public/font/AlibabaPuHuiTi-3-65-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/font/AlibabaPuHuiTi-3-65-Medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/font/AlibabaPuHuiTi-3-65-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/font/AlibabaPuHuiTi-3-65-Medium.otf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-alibaba-puhuiti",
  display: "swap",
  fallback: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"],
});

export const notoSerifSCDisplay = Noto_Serif_SC({
  weight: ["700", "900"],
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-sc-display",
  fallback: ["Source Han Serif SC", "SimSun", "serif"],
});
