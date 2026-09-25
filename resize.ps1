Add-Type -AssemblyName System.Drawing
$src = "C:\Users\davef\.gemini\antigravity\brain\e16b34d5-f75c-4660-a0c1-58b92e69d700\pit_app_icon_1790340882783.jpg"
$img = [System.Drawing.Image]::FromFile($src)

function ResizeAndSave($targetPath, $size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $size, $size)
    $g.Dispose()
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

ResizeAndSave "c:\Antigravity_work\pit_sagyou_kiroku_v2\pit_sagyou_kiroku_v2\public\pwa-192.png" 192
ResizeAndSave "c:\Antigravity_work\pit_sagyou_kiroku_v2\pit_sagyou_kiroku_v2\public\pwa-512.png" 512
ResizeAndSave "c:\Antigravity_work\pit_sagyou_kiroku_v2\pit_sagyou_kiroku_v2\public\apple-touch-icon.png" 180
$img.Dispose()
