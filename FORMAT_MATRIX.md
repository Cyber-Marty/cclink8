# cclink8 文件格式矩阵与测试边界

日期：2026-11-16
结论：**cclink8 不做扩展名过滤，打开方式交给操作系统文件关联。** 因此不需要为 300+ 个扩展名各写一套逻辑；需要保证的是“路径识别 → file URL 编码 → press → OS 关联”这条链路对任意扩展名一致。

## 1. 格式分类（14 类，常见扩展名约 300+）

| # | 类别 | 代表扩展名 | 约数 | 优先级 |
|---:|---|---|---:|---|
| 1 | 文本 / 标记 | `.txt .text .md .markdown .mdx .rst .org .tex .log .csv .tsv .srt .vtt .rtf` | 15 | P0 |
| 2 | 代码 / 配置 | `.py .js .mjs .cjs .ts .tsx .jsx .vue .svelte .html .css .scss .json .jsonl .xml .yaml .yml .toml .ini .cfg .env .sql .sh .bash .zsh .bat .cmd .ps1 .r .jl .java .kt .c .h .cpp .hpp .cs .go .rs .swift .php .rb .lua .ipynb` | 80+ | P0 |
| 3 | 办公文档 | `.doc .docx .docm .dot .dotx .xls .xlsx .xlsm .xlsb .ppt .pptx .pptm .pps .ppsx .odt .ods .odp .pages .numbers .key .wps .et .dps .vsd .vsdx .pub .one .msg .eml` | 30 | P0 |
| 4 | PDF / 电子书 | `.pdf .epub .mobi .azw .azw3 .djvu .fb2 .cbz .cbr` | 9 | P0 |
| 5 | 图片 | `.png .jpg .jpeg .gif .bmp .webp .svg .tif .tiff .ico .heic .heif .avif .raw .cr2 .nef .dng .psd .ai .eps .indd` | 25+ | P0 |
| 6 | 音频 | `.mp3 .wav .flac .aac .ogg .m4a .wma .opus .aiff .mid .midi` | 12 | P1 |
| 7 | 视频 | `.mp4 .m4v .mkv .avi .mov .wmv .flv .webm .mpg .mpeg .3gp .ts .mts` | 15 | P1 |
| 8 | 压缩 / 镜像 | `.zip .rar .7z .tar .gz .tgz .bz2 .xz .zst .cab .iso .img .dmg .vhd .vhdx .vmdk` | 20 | P0 |
| 9 | 数据 / 数据库 | `.db .sqlite .sqlite3 .mdb .accdb .parquet .feather .arrow .orc .avro .h5 .hdf5 .nc .mat .npy .npz .pkl .joblib .rds .rdata .sav .dta .sas7bdat .fits` | 25+ | P0 |
| 10 | 可执行 / 安装 / 脚本 | `.exe .msi .msix .appx .dll .sys .so .dylib .bin .com .scr .cpl .jar .war .apk .ipa .app .deb .rpm .pkg .AppImage .lnk .url .reg .vbs .vbe .wsf .hta` | 30+ | **安全敏感** |
| 11 | 字体 | `.ttf .otf .ttc .woff .woff2 .eot .fon` | 7 | P1 |
| 12 | CAD / 3D / GIS | `.dwg .dxf .dgn .stl .obj .fbx .blend .3ds .skp .step .stp .iges .igs .shp .shx .dbf .geojson .kml .kmz .gpx .las .laz .dem` | 30+ | P1 |
| 13 | 密钥 / 证书 | `.pem .crt .cer .key .pub .pfx .p12 .jks .keystore .asc .gpg .pgp .kdbx` | 13 | **安全敏感** |
| 14 | 无扩展名 / 点文件 | `README LICENSE Makefile Dockerfile .gitignore .gitattributes .editorconfig .env .bashrc .zshrc .profile .npmrc .prettierrc .eslintrc .vimrc` | 20+ | P0 |

## 2. 路径形态矩阵（比扩展名更容易出 bug）

| 形态 | 例子 | 优先级 |
|---|---|---:|
| Windows 盘符 | `C:\repo\file.py` | P0 |
| 正斜杠 | `C:/repo/file.py` | P0 |
| UNC | `\\server\share\file.docx` | P0 |
| 扩展长度 | `\\?\C:\long\file.xlsx` | P1 |
| 空格 / 中文 | `C:\工作 目录\文件.docx` | P0 |
| 括号 / 方括号 | `C:\repo\报告(1).xlsx`、`[draft].docx` | P0 |
| `#` / `%` / `&` / `+` / `,` | `a#1.pdf`、`100%.xlsx`、`A&B.docx` | P0 |
| 多后缀 | `archive.tar.gz`、`report.docx.bak` | P1 |
| 大写扩展名 | `BOOK.XLSX`、`FILE.DOCX` | P0 |
| 尾随点/空格 | `file.txt.`、`file.txt ` | P1 |
| 目录 | `C:\repo\folder` | P0 |
| 相对路径 | `.\file.md`、`../file.csv` | P1（仅 CLI/存在时） |
| file URL | `file:///C:/...`、`file://server/share/...` | P0 |
| URL | `https://example.com/a?b=1#c` | P0 |
| OneDrive 占位符 | `C:\Users\...\OneDrive\...` | P0 |
| 符号链接 / junction | `C:\link\file.xlsx` | P1 |
| 长路径 >260 | 长目录 + 文件名 | P1 |

## 3. 安全敏感格式（建议默认不自动打开）

`.exe .msi .msix .appx .dll .sys .so .dylib .com .scr .cpl .lnk .url .reg .vbs .vbe .wsf .hta .jar .apk .app .deb .rpm .pkg .AppImage` 以及脚本 `.bat .cmd .ps1 .sh .bash .zsh .py .pl .rb`。

建议：点击这些格式时**只显示提示**，要求显式 `cclink8 open` 或二次确认；不要在单击时直接执行。这是 D010 待裁决的安全策略。

## 4. 测试策略（不逐个枚举 300+）

- **P0 代表矩阵**：每类取 3–5 个代表扩展名 + 无扩展名 + 目录，共约 45 个用例。
- **路径形态矩阵**：上表 P0/P1 各一例，约 30 个用例。
- **Office 专项**：`.docx .doc .xlsx .xls .pptx .ppt .pdf`，带括号/空格/中文。
- **文本专项**：`.md .txt .csv .json .py`，验证 CSV/Markdown 与 Office 走同一路径。
- **安全专项**：`.exe .bat .ps1 .lnk .reg` 必须被拦截或要求确认。
- **真实打开**：`cclink8 open` 对每类代表文件执行一次；插件层用 `ui.press` 断言 argv，避免每次弹应用。

## 5. 当前阻塞（与格式无关）

CSV / Markdown 也失败，说明不是二进制/Office 扩展名问题，而是 **press 没有到达插件**或**终端不上报普通单击**。需要先确认：

1. 是否已重启并加载 `cclink8 0.1.5`；
2. 是否用**普通单击**（不是 Ctrl+Click）；
3. 路径是否有下划线/高亮；
4. 是否 fullscreen 渲染模式（`onLinkPress` 的普通单击依赖 fullscreen 终端上报鼠标）；
5. `cclink8 open "<path>"` 是否能打开。

若 1–3 都满足仍无反应，下一步应加 `CCLINK8_DEBUG` 日志确认 `onLinkPress` 是否触发；若确认是 surface/终端不上报单击，则需要 D011：opt-in 本地重定向服务（`cclink8 serve`，仅 127.0.0.1）或明确只支持 fullscreen CLI。
