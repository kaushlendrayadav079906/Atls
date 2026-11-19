# SAP Stock Configuration – Updated SQL Query Report

## 1. File Location
- **SQL Query File:** [pos-inventory/pos-backend/sql/sap_stock_configuration_report.sql](file:///c:/Users/A/Documents/IB/Dashboard/atl2/Atls/pos-inventory/pos-backend/sql/sap_stock_configuration_report.sql)
- **Root Query File:** [extracted_sap_query.sql](file:///c:/Users/A/Documents/IB/Dashboard/atl2/Atls/extracted_sap_query.sql)

## 2. Field Mappings (Old vs New)

| Website Column | SAP Table | Old Expression | New SQL Expression |
| :--- | :--- | :--- | :--- |
| **QC** | `OITM` | `' ' [QC]` | `T2.U_QC AS [QC]` |
| **DRW. Y/N** | `OITM` | `' ' [DRW]` | `T2.U_Drawing AS [DRW]` |
| **V CHK** | `OITM` | `' ' [V CHK]` | `T2.U_V_Chk AS [V CHK]` |
| **LM** | `OITM` | `' ' [LM]` | `T2.U_LM AS [LM]` |
| **OLNG** | `OITM` | `' ' [OLNG]` | `T2.U_OLNG AS [OLNG]` |
| **I PK** | `OITM` | `' ' [I PK]` | `T2.U_LPK AS [I PK]` |
| **LBL** | `OITM` | `' ' [LBL]` | `T2.U_LBL AS [LBL]` |
| **MC OR PT** | `OITM` | `' ' [MC or PT]` | `T2.U_MC_OR_PT AS [MC or PT]` |
| **LAST UPDATED** | `OITM` | `' ' [Last Updated]` | `T2.UpdateDate AS [Last Updated]` |
| **REMARKS** | `OPOR` | `T0.Comments [Remarks]` | `T0.Comments AS [Remarks]` |
| **NT. WEIGHT** | `OITM` | `isnull((T2.U_PerPices),0) [NT. WEIGHT]` | `ISNULL(T2.U_PerPices, 0) AS [NT. WEIGHT]` |

## 3. Query Structure & Validation
- **Branch 1:** Purchase Orders linked to Sales Orders via `OPOR.ImportEnt = ORDR.DocNum`. `GROUP BY` clause includes all selected non-aggregate fields from `T2`: `T2.U_PerPices`, `T2.U_QC`, `T2.U_Drawing`, `T2.U_V_Chk`, `T2.U_LM`, `T2.U_OLNG`, `T2.U_LPK`, `T2.U_LBL`, `T2.U_MC_OR_PT`, `T2.UpdateDate`, `TA.OpenQty`, `T0.Comments`.
- **Branch 2:** Regular Purchase Orders where `OPOR.ImportEnt IS NULL`. Contains identical 26 columns in exact alignment with Branch 1.
