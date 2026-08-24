$helperPath = 'D:\next_lms_erp\app\Helpers\Helper.php'
$controllerPath = 'D:\next_lms_erp\app\Http\Controllers\fees\fees_report\studentBreakoffReportController.php'
$replacementControllerPath = 'D:\lms_k12\.codex\tmp_studentBreakoffReportController.php'

$helperLines = [System.Collections.Generic.List[string]](Get-Content $helperPath)

$helperLines[2471] = "        if(`$syear==''){"
$helperLines.Insert(2474, "")
$helperLines.Insert(2479, "")
$helperLines.Insert(2480, "        if (count(`$data) == 0) {")
$helperLines.Insert(2481, "            return array();")
$helperLines.Insert(2482, "        }")

$helperLines[1358] = "            `$total_paid = isset(`$paid_fees[0]->total_paid) ? `$paid_fees[0]->total_paid : 0;"
$helperLines[1359] = ""
$helperLines[1360] = "            if (isset(`$final_bk[`$arr->fee_type_id])) {"
$helperLines[1361] = "                `$final_bk[`$arr->fee_type_id] = `$final_bk[`$arr->fee_type_id] + (`$arr->tot_amount - `$total_paid);"
$helperLines[1362] = "            } else {"
$helperLines[1363] = "                `$final_bk[`$arr->fee_type_id] = (`$arr->tot_amount - `$total_paid);"
$helperLines[1364] = "            }"
$helperLines[1365] = ""
$helperLines[1366] = "            // start 27-07-2021 Added by divya for getting other_fees break off amount for fees overallhead wise report"
$helperLines[1367] = "            `$other_fees_final_bk[`$student_id][`$arr->fee_type_id][`$month_id]['bf_amount'] = `$arr->tot_amount;"
$helperLines[1368] = "            `$other_fees_final_bk[`$student_id][`$arr->fee_type_id][`$month_id]['paid_amount'] = `$total_paid;"
$helperLines[1369] = "            // end 27-07-2021 Added by divya for getting other_fees break off amount for fees overallhead wise report"

[System.IO.File]::WriteAllLines($helperPath, $helperLines, [System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $replacementControllerPath -Destination $controllerPath -Force
