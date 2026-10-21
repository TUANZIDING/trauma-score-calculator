# 创伤评分计算器 · Trauma Score Calculator (v3.2)

离线、手机友好的单文件创伤评分工具：**ISS / NISS / RTS / TRISS / 休克指数 / GAP / MGAP / rSIG**，附危险分级、首要操作提示和教学模式。
An offline, mobile-friendly single-file calculator for ISS, NISS, RTS, TRISS, shock index, GAP, MGAP and rSIG, with risk tiers, guideline-based action prompts and a teaching mode.

> ⚠️ 仅供临床参考与教学，不构成医嘱，不是医疗器械。AIS 严重度须由医生依 AAAM 官方手册判定；本工具不含 AIS 词典。
> For clinical reference and education only. Not a medical device. AIS codes must come from the official AAAM manual; no AIS dictionary is included.

## 使用 · Use
- 直接打开 [`index.html`](index.html)（可离线、无需安装、不上传任何数据）。
- 启用 GitHub Pages（Settings → Pages → main / root）后可在线访问。

## 功能 · Features
- **逐条损伤录入**，自动计算 ISS / NISS，标注 AIS 版本；AIS 6 自动按 ISS=75 处理。
- **RTS / T-RTS / TRISS**：系数版本透明可切换（MTOS 1995 等），<15 岁穿透伤按钝性系数。
- **危险分级**（红 / 橙 / 黄 / 绿），显示触发条件与复评间隔。
- **首要操作 + 操作清单**，可按医生 / 护士 / 团队筛选，每条注明指南出处（ATLS 11、欧洲大出血指南 2023、中国创伤失血性休克共识 2023、ACS 分诊 2021、TQIP、CRASH-2、BTF 等）。
- **教学模式**：双人对比录入、评分小课堂、病例练习。
- **床旁生理评分（v3.2）**：GAP、MGAP、rSIG，只需 GCS/年龄/SBP/HR，无需 AIS 与呼吸频率。
- **ICD-10 交叉核对（v3.2，实验性）**：粘贴诊断编码，按 ICDPIC-R 映射表粗估 ISS/NISS，与手工 AIS 对比并提示复核；支持国家临床版扩展码。不参与分级与 TRISS。
- **内置自检** 34/34。

## 外部验证 · External validation
用工具自身计算核心在三个公开国际数据集上检验，详见 [`validation/validation_report.md`](validation/validation_report.md)。

| 数据集 | n | 结果 |
|---|---|---|
| TITCO-I（印度） | 14,755 | TRISS AUC 0.830，RTS 0.832，ISS 0.609，NISS 0.638 |
| CRASH-2（40 国） | 20,207 | RTS AUC 0.808，SI 0.627 |
| UVA（美国） | 18,680 | ISS AUC 0.821，NISS 0.817（文献 0.830 / 0.827） |

- 与 CRAN `traumar` 1.2.7 比对 1,000 组输入，TRISS 最大差 2.2×10⁻¹⁶。
- **校准警示**：MTOS 系数在 TITCO 中预期死亡 383 例、实际 1,479 例；在中国人群使用 Ps 须谨慎。
- 危险分级红色组死亡率：TITCO 46.2%，CRASH-2 25.8%，UVA 33.5%。
- v3.2：GAP AUC TITCO 0.837、CRASH-2 0.793；MGAP 0.831 / 0.767；rSIG 0.815 / 0.789。ICD 估算 ISS 与手工 AIS-ISS Spearman 0.46（TITCO），只作提示。
- 均非中国数据；插管、FAST、抗凝等条件未经数据检验。

原始数据不随仓库分发，请自行下载到 `validation/data/`：
TITCO-I（CC BY 4.0，doi:10.5281/zenodo.7832819）· CRASH-2（LSHTM freeBIRD）· UVA（CC BY 4.0，doi:10.6084/m9.figshare.19606138）。
复现：`cd validation/scripts && python3 prep.py && node run.js && Rscript impl.R && python3 metrics.py && node tiers_v3.js`
；v3.2：`node bedside_v3.2.js && python3 bedside_metrics_v3.2.py`、`python3 icd_prep_v3.2.py && node icd_run_v3.2.js && python3 icd_metrics_v3.2.py`

## 开发 · Development
修改 `src/ui.html`、`src/core.js`、`src/lesson.html`、`src/icdmap.js`，然后 `python3 build.py` 生成 `index.html`。

## 致谢 · Acknowledgements
TRISS 实现与 [bemts-hhs/traumar](https://github.com/bemts-hhs/traumar)（MIT）比对验证。ICD-10 映射表来自 [ICDPIC-R / icdpicr](https://github.com/ablack3/icdpicr)（MIT，Copyright (c) 2020 David Clark, Adam Black），见 `THIRD_PARTY_NOTICES.md`。感谢 TITCO、CRASH-2 与 UVA 数据的公开共享。

作者：丁海祥 Haixiang Ding, MD · Emergency and Trauma Surgeon
