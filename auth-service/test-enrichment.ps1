$authUrl = "http://localhost:3001/api/auth"
$itineraryUrl = "http://localhost:3003"

$loginBody = @{ email = "alice@example.com"; password = "secret123" } | ConvertTo-Json
try {
    $loginResponse = Invoke-RestMethod -Uri "$authUrl/login" -Method Post -Body $loginBody -ContentType "application/json"
} catch {
    Write-Host "Login a echoue, tentative d inscription..." -ForegroundColor Magenta
    $registerBody = @{ full_name = "Alice Dupont"; email = "alice@example.com"; password = "secret123" } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "$authUrl/register" -Method Post -Body $registerBody -ContentType "application/json"
}
$token = $loginResponse.token
Write-Host "=== Token recu ===" -ForegroundColor Cyan
Write-Host $token

$headers = @{ Authorization = "Bearer $token" }

$createBody = @{ title = "Test enrichissement"; destination_ids = @(1,2) } | ConvertTo-Json
$createResponse = Invoke-RestMethod -Uri "$itineraryUrl/api/itineraries" -Method Post -Body $createBody -ContentType "application/json" -Headers $headers
Write-Host "=== Itineraire cree ===" -ForegroundColor Green
$createResponse | ConvertTo-Json

$itineraryId = $createResponse.itinerary_id

Write-Host "=== Lecture avec enrichissement ===" -ForegroundColor Yellow
$getResponse = Invoke-RestMethod -Uri "$itineraryUrl/api/itineraries/$itineraryId" -Method Get -Headers $headers
$getResponse | ConvertTo-Json -Depth 5
