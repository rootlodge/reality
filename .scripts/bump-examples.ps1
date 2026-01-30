# Bump minor version in package.json files under "examples" directories
Get-ChildItem -Path . -Recurse -Filter package.json | Where-Object { $_.DirectoryName -match "\\examples\\" -and $_.DirectoryName -notmatch "\\node_modules\\" } | ForEach-Object {
    $file = $_.FullName
    Write-Output "=== bump package.json: $file ==="
    try {
        $pkg = Get-Content $file -Raw | ConvertFrom-Json
        if ($pkg.version) {
            $parts = $pkg.version -split '\\.'
            if ($parts.Length -ge 3) {
                $major = [int]$parts[0]
                $minor = [int]$parts[1]
                $patch = [int]$parts[2]
                $minor = $minor + 1
                $patch = 0
                $pkg.version = "$major.$minor.$patch"
                $pkg | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 $file
                Write-Output "Bumped to $($pkg.version)"
            }
        }
    } catch {
        Write-Error ("Failed to bump " + $file + ": " + $_.Exception.Message)
    }
}
