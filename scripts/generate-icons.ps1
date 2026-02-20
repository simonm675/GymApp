Add-Type -AssemblyName System.Drawing

function New-GymIcon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $graphics.Clear([System.Drawing.Color]::Transparent)

  $margin = [int]($Size * 0.055)
  $radius = [int]($Size * 0.22)
  $iconSize = $Size - (2 * $margin)

  $rect = New-Object System.Drawing.Rectangle($margin, $margin, $iconSize, $iconSize)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 255, 176, 102),
    [System.Drawing.Color]::FromArgb(255, 255, 106, 0),
    45
  )
  $graphics.FillPath($brush, $path)

  $overlayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 0, 0, 0))
  $graphics.FillPath($overlayBrush, $path)

  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 247, 248, 250))
  $gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 216, 218, 223))

  function Fill-RoundRect {
    param(
      [System.Drawing.Graphics]$G,
      [System.Drawing.Brush]$B,
      [float]$X,
      [float]$Y,
      [float]$W,
      [float]$H,
      [float]$R
    )

    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $p.AddArc($X, $Y, $d, $d, 180, 90)
    $p.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $p.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $p.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    $G.FillPath($B, $p)
    $p.Dispose()
  }

  Fill-RoundRect -G $graphics -B $white -X ($Size * 0.197) -Y ($Size * 0.412) -W ($Size * 0.088) -H ($Size * 0.176) -R ($Size * 0.033)
  Fill-RoundRect -G $graphics -B $white -X ($Size * 0.293) -Y ($Size * 0.381) -W ($Size * 0.094) -H ($Size * 0.238) -R ($Size * 0.033)
  Fill-RoundRect -G $graphics -B $white -X ($Size * 0.395) -Y ($Size * 0.463) -W ($Size * 0.211) -H ($Size * 0.074) -R ($Size * 0.027)
  Fill-RoundRect -G $graphics -B $white -X ($Size * 0.613) -Y ($Size * 0.381) -W ($Size * 0.094) -H ($Size * 0.238) -R ($Size * 0.033)
  Fill-RoundRect -G $graphics -B $white -X ($Size * 0.715) -Y ($Size * 0.412) -W ($Size * 0.088) -H ($Size * 0.176) -R ($Size * 0.033)

  Fill-RoundRect -G $graphics -B $gray -X ($Size * 0.213) -Y ($Size * 0.428) -W ($Size * 0.057) -H ($Size * 0.145) -R ($Size * 0.023)
  Fill-RoundRect -G $graphics -B $gray -X ($Size * 0.730) -Y ($Size * 0.428) -W ($Size * 0.057) -H ($Size * 0.145) -R ($Size * 0.023)

  $dir = Split-Path -Parent $OutputPath
  if (!(Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $white.Dispose()
  $gray.Dispose()
  $overlayBrush.Dispose()
  $brush.Dispose()
  $path.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-GymIcon -Size 180 -OutputPath "public/apple-touch-icon.png"
New-GymIcon -Size 192 -OutputPath "public/icon-192.png"
New-GymIcon -Size 512 -OutputPath "public/icon-512.png"