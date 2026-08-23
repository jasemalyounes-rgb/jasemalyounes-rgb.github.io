param([string]$Lang='ar')
$ErrorActionPreference='Stop'
$base='c:\Users\jj\Desktop\web dev\potfolio\_bld'
$src="$base\$Lang"
$out="$base\$Lang.docx"
$pdf="$base\$Lang.pdf"

foreach ($f in @($out,$pdf)) { if (Test-Path $f) { Remove-Item $f -Force } }

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

# Export READ-ONLY. Letting Word save strips the paragraph-level <w:bidi/> and
# silently turns the Arabic document left-to-right; the XML we just wrote
# already carries the direction, so nothing needs to be set through COM.
$w=New-Object -ComObject Word.Application
$w.Visible=$false; $w.DisplayAlerts=0
$w.Options.CheckGrammarAsYouType=$false
$w.Options.CheckSpellingAsYouType=$false
try {
  $d=$w.Documents.Open($out,$false,$true)
  $links=$d.Hyperlinks.Count
  $d.SaveAs([ref]$pdf,[ref]17)
  $d.Close($false)
  Write-Output ("[$Lang] links=$links pdf=" + (Get-Item $pdf).Length)
} finally { $w.Quit() }
