$content = Get-Content -Path 'src/lib/i18n.tsx' -Raw -Encoding UTF8
$content = $content -replace '" teilnehmer ', '" भाग लेने वाले '
Set-Content -Path 'src/lib/i18n.tsx' -Value $content -NoNewline -Encoding UTF8
Write-Host "Fixed"