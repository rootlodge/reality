# Publish any example packages that have a package.json under an "examples" directory
Get-ChildItem -Path . -Recurse -Filter package.json | Where-Object { $_.DirectoryName -match "\\examples\\" -and $_.DirectoryName -notmatch "\\node_modules\\" } | ForEach-Object {
    $dir = $_.DirectoryName
    Write-Output "=== npm publish: $dir ==="
    Push-Location $dir
    try {
        npm publish --access public
    } catch {
        Write-Error ("npm publish failed in " + $dir + ": " + $_.Exception.Message)
    }
    Pop-Location
}
