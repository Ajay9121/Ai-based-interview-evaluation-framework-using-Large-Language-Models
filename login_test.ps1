 = @{email = " admin@interview.com\; password = \admin123\}; = | ConvertTo-Json; Invoke-RestMethod -Uri \http://localhost:8080/api/auth/login\ -Method Post -ContentType \application/json\ -Body 
