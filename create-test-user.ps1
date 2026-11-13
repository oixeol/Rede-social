$body = @{
    username = 'teste'
    name = 'Teste User'
    password = 'Teste123!@#'
    birthDate = '2000-01-01'
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'http://localhost:4173/api/register' -Method Post -Body $body -ContentType 'application/json'
    Write-Host "Sucesso: $($response | ConvertTo-Json)"
} catch {
    Write-Host "Erro: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Detalhes: $errorBody"
    }
}