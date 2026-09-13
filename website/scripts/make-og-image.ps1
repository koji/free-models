# Generates website/public/og-image.png at exactly 1200x630.
# White background, serif title, sans subtitle, one accent element.
# Rerunnable: overwrites the same output path every run.
Add-Type -AssemblyName System.Drawing

$outPath = Join-Path $PSScriptRoot "../public/og-image.png"
$outPath = [System.IO.Path]::GetFullPath($outPath)

$width = 1200
$height = 630

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
try {
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::White)

    $primary = [System.Drawing.ColorTranslator]::FromHtml("#529fcb")
    $accent = [System.Drawing.ColorTranslator]::FromHtml("#211f54")
    $muted = [System.Drawing.ColorTranslator]::FromHtml("#4a4a4a")

    $accentBrush = New-Object System.Drawing.SolidBrush($primary)
    try {
      $g.FillRectangle($accentBrush, 0, 0, $width, 18)
      $g.FillRectangle($accentBrush, 96, 470, 120, 10)
    }
    finally { $accentBrush.Dispose() }

    $titleFont = $null
    $subtitleFont = $null
    try {
      $titleFont = New-Object System.Drawing.Font("Georgia", 72, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    }
    catch {
      $titleFont = New-Object System.Drawing.Font("Serif", 72, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    }
    try {
      $subtitleFont = New-Object System.Drawing.Font("Segoe UI", 32, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    }
    catch {
      $subtitleFont = New-Object System.Drawing.Font("Arial", 32, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    }
    try {
      $titleBrush = New-Object System.Drawing.SolidBrush($accent)
      $subtitleBrush = New-Object System.Drawing.SolidBrush($muted)
      try {
        $g.DrawString("OpenRouter Free Models", $titleFont, $titleBrush, 90, 210)
        $g.DrawString("Hourly updated list of free models on OpenRouter.", $subtitleFont, $subtitleBrush, 92, 360)
      }
      finally {
        $titleBrush.Dispose()
        $subtitleBrush.Dispose()
      }
    }
    finally {
      $titleFont.Dispose()
      $subtitleFont.Dispose()
    }
  }
  finally { $g.Dispose() }

  $dir = [System.IO.Path]::GetDirectoryName($outPath)
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally { $bitmap.Dispose() }

Write-Output $outPath
