import localFont from "next/font/local";

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
