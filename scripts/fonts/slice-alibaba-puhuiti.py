"""
把阿里巴巴普惠体按 unicode-range 切成 woff2 分片，并生成对应的 @font-face CSS。

分片边界直接复用 @fontsource/noto-serif-sc 的 unicode-range（即 Google Fonts 按字频切出的分片），
这样正文字体和衬线标题字体在同一页面上命中的是同一组区间，浏览器只下载用到的分片。
Google 分片只覆盖常用字，字体里其余的生僻字（扩展 A 等）另外按码位切成余量分片，保证不丢字。

用法（需要 fontTools 与 brotli，不进项目依赖，建议放临时 venv）：
  python3 -m venv /tmp/fontvenv && /tmp/fontvenv/bin/pip install fonttools brotli
  /tmp/fontvenv/bin/python scripts/fonts/slice-alibaba-puhuiti.py public/font/AlibabaPuHuiTi-3-65-Medium.otf 500

产物：
  src/styles/fonts/alibaba-puhuiti/<weight>.css
  src/styles/fonts/alibaba-puhuiti/files/alibaba-puhuiti-<weight>-<index>.woff2
"""

import io
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
RANGES_CSS = ROOT / "node_modules/@fontsource/noto-serif-sc/700.css"
OUTPUT_DIR = ROOT / "src/styles/fonts/alibaba-puhuiti"
FONT_FAMILY = "Alibaba PuHuiTi"
REMAINDER_SLICE_SIZE = 1000

SLICE_PATTERN = re.compile(
    r"/\* noto-serif-sc-\[(\d+)\]-700-normal \*/.*?unicode-range:\s*([^;]+);",
    re.DOTALL,
)


def read_slices():
    slices = [(int(index), ranges.strip()) for index, ranges in SLICE_PATTERN.findall(RANGES_CSS.read_text())]
    if not slices:
        raise SystemExit(f"没有从 {RANGES_CSS} 解析出 unicode-range，检查 @fontsource/noto-serif-sc 是否已安装")
    return slices


def parse_unicode_range(ranges):
    codepoints = set()
    for part in ranges.split(","):
        start, _, end = part.strip().removeprefix("U+").partition("-")
        codepoints.update(range(int(start, 16), int(end or start, 16) + 1))
    return codepoints


def format_unicode_range(codepoints):
    parts = []
    ordered = sorted(codepoints)
    start = previous = ordered[0]
    for codepoint in ordered[1:] + [None]:
        if codepoint is not None and codepoint == previous + 1:
            previous = codepoint
            continue
        parts.append(f"U+{start:x}" if start == previous else f"U+{start:x}-{previous:x}")
        if codepoint is not None:
            start = previous = codepoint
    return ",".join(parts)


def remainder_slices(slices, covered):
    """Google 分片只覆盖常用字；字体里剩下的生僻字按码位顺序再切几片，用到才下载。"""
    remaining = sorted(covered - set().union(*(parse_unicode_range(ranges) for _, ranges in slices)))
    first_index = max(index for index, _ in slices) + 1
    return [
        (first_index + offset, format_unicode_range(remaining[start : start + REMAINDER_SLICE_SIZE]))
        for offset, start in enumerate(range(0, len(remaining), REMAINDER_SLICE_SIZE))
    ]


def build_slice(font_bytes, codepoints):
    font = TTFont(io.BytesIO(font_bytes))
    options = subset.Options()
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    output = io.BytesIO()
    font.save(output)
    return output.getvalue()


def main():
    if len(sys.argv) != 3:
        raise SystemExit("用法: slice-alibaba-puhuiti.py <源字体 otf/ttf> <字重，如 500>")

    source, weight = Path(sys.argv[1]), sys.argv[2]
    font_bytes = source.read_bytes()
    covered = set(TTFont(io.BytesIO(font_bytes)).getBestCmap())

    files_dir = OUTPUT_DIR / "files"
    files_dir.mkdir(parents=True, exist_ok=True)
    for stale in files_dir.glob(f"alibaba-puhuiti-{weight}-*.woff2"):
        stale.unlink()

    slices = read_slices()
    rules = []
    total_bytes = 0
    for index, ranges in slices + remainder_slices(slices, covered):
        codepoints = parse_unicode_range(ranges) & covered
        if not codepoints:
            continue

        filename = f"alibaba-puhuiti-{weight}-{index}.woff2"
        data = build_slice(font_bytes, codepoints)
        (files_dir / filename).write_bytes(data)
        total_bytes += len(data)
        rules.append(
            f"/* alibaba-puhuiti-[{index}]-{weight}-normal */\n"
            "@font-face {\n"
            f"  font-family: '{FONT_FAMILY}';\n"
            "  font-style: normal;\n"
            "  font-display: swap;\n"
            f"  font-weight: {weight};\n"
            f"  src: url(./files/{filename}) format('woff2');\n"
            f"  unicode-range: {ranges};\n"
            "}\n"
        )

    header = (
        f"/* 由 scripts/fonts/slice-alibaba-puhuiti.py 从 {source.name} 生成，不要手改。 */\n"
        "/* 分片边界取自 @fontsource/noto-serif-sc 的 unicode-range。 */\n\n"
    )
    (OUTPUT_DIR / f"{weight}.css").write_text(header + "\n".join(rules))
    print(f"{len(rules)} 个分片，共 {total_bytes / 1024 / 1024:.2f} MB -> {OUTPUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
