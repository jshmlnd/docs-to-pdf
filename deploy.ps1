# Deploys to Heroku (app: docs-to-pdf, https://docs-to-pdf.zjkm.tech). Run from this folder.
# Needs Docker running and `heroku login` done.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

heroku container:login
# Heroku's registry rejects Docker Desktop's default OCI manifests and build attestations ("unsupported"),
# so build a plain Docker v2 image for linux/amd64 and push it directly.
docker buildx build --platform linux/amd64 --provenance=false --sbom=false `
  --output "type=registry,oci-mediatypes=false" -t registry.heroku.com/docs-to-pdf/web .
if ($LASTEXITCODE -ne 0) { throw 'docker build/push failed' }
heroku container:release web -a docs-to-pdf
