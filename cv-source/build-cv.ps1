param([string]$Lang='ar')
$ErrorActionPreference='Stop'
$base='c:\Users\jj\Desktop\web dev\potfolio\_cv5'
$src="$base\$Lang"
$out="$base\$Lang.docx"
$html="$base\$Lang.html"
$pdf="$base\$Lang.pdf"

foreach ($f in @($out,$html,$pdf)) { if (Test-Path $f) { Remove-Item $f -Force } }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::Open($out,'Create')
$bs=[string][char]92
$fw=[string][char]47
try {
  Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
    $rel=$_.FullName.Substring($src.Length+1).Replace($bs,$fw)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$rel,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }

$w=New-Object -ComObject Word.Application
$w.Visible=$false; $w.DisplayAlerts=0
$w.Options.CheckGrammarAsYouType=$false
$w.Options.CheckSpellingAsYouType=$false
try {
  $d=$w.Documents.Open($out,$false,$false,$false)
  if ($Lang -eq 'ar') {
    $d.Content.ParagraphFormat.ReadingOrder=1     # wdReadingOrderRtl
    $d.Content.ParagraphFormat.Alignment=2        # right
  } else {
    $d.Content.ParagraphFormat.ReadingOrder=0     # wdReadingOrderLtr
    $d.Content.ParagraphFormat.Alignment=0        # left
  }
  # header block (name / role / contact) stays centered in both languages
  for ($i=1; $i -le 3; $i++) { $d.Paragraphs($i).Format.Alignment=1 }
  $d.Save()

  $rtl=0
  foreach ($p in $d.Paragraphs) { if ($p.Format.ReadingOrder -eq 1) { $rtl++ } }
  $pages=$d.ComputeStatistics(2)
  $links=$d.Hyperlinks.Count
  $d.SaveAs([ref]$html,[ref]10)
  $d.SaveAs([ref]$pdf,[ref]17)
  $d.Close($false)
  Write-Output ("[$Lang] pages=$pages links=$links rtlParas=$rtl/" + $(if($Lang -eq 'ar'){'all'}else{'0 expected'}) + " pdf=" + (Get-Item $pdf).Length)
} finally { $w.Quit() }
