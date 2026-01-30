# Recursively find package.json files under any "examples" folder and run npm install in their directories
Get-ChildItem -Path . -Recurse -Filter package.json | Where-Object { $_.DirectoryName -match "\\examples\\" -and $_.DirectoryName -notmatch "\\node_modules\\" } | ForEach-Object {
    $dir = $_.DirectoryName
    Write-Output "=== npm install: $dir ==="
    Push-Location $dir
    try {
        npm install --no-audit --no-fund
    } catch {
        Write-Error ("npm install failed in " + $dir + ": " + $_.Exception.Message)
    }
    Pop-Location
}
