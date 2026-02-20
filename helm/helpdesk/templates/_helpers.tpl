{{/*
_helpers.tpl — reusable template snippets
ชื่อขึ้นต้นด้วย _ = Helm จะไม่ render เป็น manifest
ใช้ผ่าน {{ include "helpdesk.labels" . }}
*/}}

{{/* Standard labels ที่ทุก resource ควรมี */}}
{{- define "helpdesk.labels" -}}
app.kubernetes.io/name: helpdesk
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}
