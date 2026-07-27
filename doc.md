# 9. Sanity Check — Post-Generation Validation

**File:** `sanity.py`  
**Active code starts at:** ~line 1180 (~1,000 lines active)

The sanity check runs after claim generation to validate that every generated `.xlsb` file matches the master CSV report.

---

# 9.1 Overview

The sanity check performs these validations for every claim file:

| Check              | What it compares                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Vendor Number      | Master Report `VEND_NUM` vs Claim Summary tab **SAP vendor #**                                                    |
| Claim Amount       | Master Report `CLAIM_AMT` vs **Claim Total Earned** (Shipments or Scanned Sales tab depending on delivery method) |
| Final Claim Amount | Master Report total vs Claim Summary tab **cell C33**                                                             |
| Variance           | Master Claim Amount − Claim Amount (**tolerance: ±$0.02**)                                                        |
| File Existence     | Claims in master with no generated file → flagged as **FILE NOT GENERATED**                                       |
| Currency           | Master `CURRENCY` vs Claim Summary `C27`                                                                          |

---

# 9.2 File Helpers

| Function                                 | Purpose                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `check_file_accessible(path)`            | Tests if a file can be opened (not locked by Excel)                                |
| `decrypt_excel(path)`                    | Decrypts password-protected `.xlsb` using **msoffcrypto** with password `" VIF"`   |
| `read_xlsb(path, sheet, header)`         | Reads a sheet from `.xlsb`; tries decryption first, then falls back to direct read |
| `extract_claim_number(filename)`         | Parses `"VAA13034 - 1009013 - ..."` → `"VAA13034"`                                 |
| `extract_vendor_from_filename(filename)` | Parses `"VAA13034 - 1009013 - ..."` → `"1009013"`                                  |

---

# 9.3 get_claim_info(xlsb_path) — Parse One Claim File

Reads the `.xlsb` file and extracts:

## From Summary tab (iterates all cells searching for labels)

- **SAP vendor #** → `info["vendor"]`
- **Delivery Method** → `info["delivery"]`
  - `"Warehouse"`
  - `"DSD"`
- **Currency** → `info["currency"]`
- **Claim Amount** → `info["final_claim"]` (value from **C33**)

## From Shipments or Scanned Sales tab (based on delivery method)

If delivery method is:

**Warehouse / WHS**
→ Reads **Shipments** tab (header at row 2)  
→ Sums **Total Earned** column

**DSD / SC**
→ Reads **Scanned Sales** tab (header at row 2)  
→ Sums **Total Earned** column

Column detection logic searches headers for:

```
Total Earned
earned
claim
```

---

# 9.4 load_all_master_reports(reports_dir) — Load Master CSV

Steps:

- Finds all `.csv` files inside the reports directory
- Loads and concatenates them
- Cleans `CLAIM_NUMBER`
  - strips whitespace
  - removes non-breaking spaces
- Cleans `VEND_NUM`
  - creates `VEND_NUM_CLEAN`
  - strips leading zeros
- Drops rows with missing:
  - claim numbers
  - vendor numbers

---

# 9.5 run_sanity_check(base_folder) — Core Validation Logic

**Input:**

Folder structure:

```
reports/
claims/
 ├── Auto_Approve/
 └── Manual_Review/
```

## Processing Logic

For each `.xlsb` file:

### Step 1

Extract:

- claim number
- vendor number

(from filename)

### Step 2

Call:

```
get_claim_info()
```

to read Excel values

### Step 3

Skip claims with:

```
final amount < $100
```

### Step 4

Match claim with master report rows using:

```
(CLAIM_NUMBER, VEND_NUM_CLEAN)
```

Fallback match:

```
CLAIM_NUMBER only
```

(used when vendor formatting differs)

### Step 5

Compute:

```
master_amt = sum(CLAIM_AMT)
```

from matched master rows

### Step 6

Determine claim source:

| Delivery Method | Source Tab    |
| --------------- | ------------- |
| Warehouse       | Shipments     |
| DSD             | Scanned Sales |

### Step 7

Calculate:

```
variance = master_amt − claim_compare_amt
```

Tolerance:

```
± $0.02
```

### Step 8 — Assign Match Status

| Status              | Meaning                                     |
| ------------------- | ------------------------------------------- |
| PASS                | variance within tolerance                   |
| FAIL                | variance exceeds tolerance                  |
| NOT FOUND IN MASTER | no matching master rows                     |
| VENDOR MISMATCH     | vendor numbers differ                       |
| FILE NOT GENERATED  | master has claim but no `.xlsb` file exists |

### Step 9 — Post Processing

After processing all files:

Check master report claims with **no generated `.xlsb` file**

Add them as:

```
FILE NOT GENERATED
```

rows

### Output

Returns:

```
DataFrame
```

Containing:

- one row per claim file
- one row per missing claim file

---

# 9.6 SanityCheckRunner — Orchestration Class

Located around:

```
line ~1694
```

Wraps validation logic with **GCS download/upload workflow**

## run_sanity_check(period_name, db_manager, start_date) — Full Flow

| Step | Action                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 1    | Resolve period from `start_date` via `RLDMPROD_V.CAL_DT`, fallback → `CURRENT_DATE`, then `ED_YEAR_PERIOD` |
| 2    | Initialize GCS client                                                                                      |
| 3    | Build GCS paths                                                                                            |
| 4    | Create temp directory                                                                                      |
| 5    | Download master CSV from GCS                                                                               |
| 6    | Download `.xlsb` claim files                                                                               |
| 7    | Execute core sanity check                                                                                  |
| 8    | Generate report                                                                                            |
| 9    | Upload report to GCS                                                                                       |
| 10   | Cleanup temp directory                                                                                     |

## GCS Path Pattern

```
{gcs_output_path}/{year}/P{period}/reports/
{gcs_output_path}/{year}/P{period}/claims/
```

## Temporary Directory Structure

```
data/sanity_check_temp/{period_name}/
 ├── reports/
 ├── claims/
 └── sanity_output/
```

## Function Return

Returns dictionary:

```
{
 success,
 period,
 total,
 passed,
 failed,
 not_generated
}
```

---

# 9.7 \_generate_report() — Generate Excel + CSV Report

Creates:

```
CSV
Excel
```

outputs

## CSV Output

Contains:

```
raw validation DataFrame
```

(no formatting)

## Excel Output Structure

Contains **3 sheets**

### Sheet 1 — Reconciliation

Summary metrics:

- total claims expected
- total claims generated
- total claim amount (USD)
- total claim amount (CAD)

Comparison:

```
master vs generated
```

### Sheet 2 — Detailed Results

One row per claim

Includes:

- VAA Number
- File Name
- File Status
- Folder
- Delivery Method
- Vendor (master vs claim)
- Currency (master vs claim)
- Match status
- Claim amounts:
  - master
  - shipments
  - scanned sales
  - final
- Variance

### Sheet 3 — Checks Summary

5-row validation matrix:

| Check                          | Status |
| ------------------------------ | ------ |
| Claim count reconciliation     | ✔      |
| VAA number validation          | ✔      |
| File availability verification | ✔      |
| Vendor number reconciliation   | ✔      |
| Dollar value reconciliation    | ✔      |

---

# 9.8 create_sanity_check_runner() — Factory Function

Usage:

```
runner = create_sanity_check_runner(
    db_manager=db,
    config=cfg
)

result = runner(
    period_name=None,
    start_date="2025-03-23"
)
```

Returns:

```
callable sanity check executor
```

Runs full workflow:

```
download → validate → generate report → upload
```

Claim Generator — Following the Actual Call Flow
Step 1: init() — Construction
Step 2: get_year_and_period()
Step 3: _fetch_data_from_teradata()
Step 4: BaseClaimGenerator.init()
Step 5: generate_claims_for_all_combinations()
Step 6: _process_claim_task() — Build One Excel Claim File
Step 7: Post-Generation