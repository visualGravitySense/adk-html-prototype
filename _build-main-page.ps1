# Assemble MainPage.dc.html from section prototypes (no Node required).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\doc\html\footer-prototype\_build-main-page.ps1

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$ORDER = @(
  'Header.dc.html',
  'Hero.dc.html',
  'RequestForm.dc.html',
  'ServicesSymptoms.dc.html',
  'EquipmentTeamB2B.dc.html',
  'Footer.dc.html'
)

function Get-Template([string]$src, [string]$file) {
  $m = [regex]::Match($src, '(?is)<x-dc(?:\s[^>]*)?>(.*?)</x-dc>')
  if (-not $m.Success) { throw "$file : no <x-dc> block" }
  $t = $m.Groups[1].Value.Trim()
  if ($t.Length -lt 200) { throw "$file : template too short ($($t.Length))" }
  return $t
}

function Get-ClassInner([string]$src, [string]$file) {
  $m = [regex]::Match($src, '(?is)<script\b[^>]*data-dc-script[^>]*>(.*?)</script>')
  if (-not $m.Success) {
    Write-Warning "$file : no data-dc-script"
    return ''
  }
  $script = $m.Groups[1].Value
  $cm = [regex]::Match($script, '(?s)class\s+Component\s+extends\s+DCLogic\s*\{')
  if (-not $cm.Success) {
    Write-Warning "$file : no Component class"
    return $script.Trim()
  }
  $open = $script.IndexOf('{', $cm.Index)
  $depth = 0
  for ($i = $open; $i -lt $script.Length; $i++) {
    $ch = $script[$i]
    if ($ch -eq '{') { $depth++ }
    elseif ($ch -eq '}') {
      $depth--
      if ($depth -eq 0) {
        return $script.Substring($open + 1, $i - $open - 1).Trim()
      }
    }
  }
  throw "$file : unclosed Component class"
}

function Strip-Redeclarations([string]$inner, [string]$file) {
  $s = $inner
  $s = [regex]::Replace($s, '(?ms)renderVals\s*=\s*\([^)]*\)\s*=>\s*\{.*?\n  \}', '/* renderVals → unified */')
  $s = [regex]::Replace($s, '(?ms)renderVals\s*\(\)\s*\{.*?\n  \}', '/* renderVals → unified */')
  $s = [regex]::Replace($s, '(?ms)state\s*=\s*\{.*?\n  \};', '/* state → unified */')
  $s = [regex]::Replace($s, 'ticks\s*=\s*Array\.from\(\{\s*length:\s*\d+\s*\}\);', '/* ticks → unified */')
  $s = [regex]::Replace($s, '(?ms)scrollToForm\s*=\s*\([^)]*\)\s*=>\s*\{.*?\n  \};', '/* scrollToForm → unified */')
  $s = [regex]::Replace($s, '(?ms)scrollToTop\s*=\s*\([^)]*\)\s*=>\s*\{.*?\n  \};', '/* scrollToTop → unified */')
  return "  /* --- from $file --- */`n$($s.Trim())"
}

$templates = New-Object System.Collections.Generic.List[string]
$members = New-Object System.Collections.Generic.List[string]

foreach ($file in $ORDER) {
  $path = Join-Path $here $file
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing $path" }
  $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  $t = Get-Template $raw $file
  $c = Get-ClassInner $raw $file
  Write-Host ("OK {0}: template {1} chars, class {2} chars" -f $file, $t.Length, $c.Length)
  [void]$templates.Add("<!-- ══ $file ══ -->`n$t")
  [void]$members.Add((Strip-Redeclarations $c $file))
}

$templateBlock = ($templates -join "`n`n")
$memberBlock = ($members -join "`n`n")

$out = @"
<!DOCTYPE html>
<html lang="et">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Auto Diislikeskus — Main Prototype</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<script src="./image-slot.js"></script>
<style>
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #F8F9FA; }
</style>
</helmet>

$templateBlock

</x-dc>
<script type="text/x-dc" data-dc-script data-props="{&quot;`$preview&quot;:{&quot;width&quot;:1440,&quot;height&quot;:5600}}">
class Component extends DCLogic {
$memberBlock

  /* ── Unified state & shared handlers ── */
  state = {
    menuOpen: false,
    lang: 'EE',
    plate: '', make: '', year: '', engine: '', description: '',
    name: '', phone: '', email: '',
    showManualFields: false,
    isSubmitting: false, isSuccess: false, isError: false,
  };

  ticks = Array.from({ length: 28 });

  scrollToForm = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const el = document.getElementById('request-form');
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  scrollToTop = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  renderVals() {
    const s = this.state;
    const lang = s.lang || 'EE';
    const active = '#171717';
    const idle = '#a3a3a3';

    const navLinksByLang = this.navLinksByLang || {
      EE: [
        { href: '#teenused-sumptoomid', label: 'Teenused', num: '01' },
        { href: '#request-form', label: 'Päring', num: '02' },
        { href: '#seadmed', label: 'Seadmed', num: '03' },
        { href: '#kontakt', label: 'Kontakt', num: '04' },
      ],
      RU: [
        { href: '#teenused-sumptoomid', label: 'Услуги', num: '01' },
        { href: '#request-form', label: 'Запрос', num: '02' },
        { href: '#seadmed', label: 'Оборудование', num: '03' },
        { href: '#kontakt', label: 'Контакты', num: '04' },
      ],
      EN: [
        { href: '#teenused-sumptoomid', label: 'Services', num: '01' },
        { href: '#request-form', label: 'Quote', num: '02' },
        { href: '#seadmed', label: 'Equipment', num: '03' },
        { href: '#kontakt', label: 'Contact', num: '04' },
      ],
    };

    const hoursByLang = this.hoursByLang || {
      EE: 'E–R 9–18',
      RU: 'Пн–Пт 9–18',
      EN: 'Mon–Fri 9–18',
    };

    const footerI18n =
      (this.i18n && (this.i18n[lang] || this.i18n.EE || this.i18n.RU)) || {};

    return {
      menuOpen: s.menuOpen,
      toggleMenu: this.toggleMenu || (() => this.setState((st) => ({ menuOpen: !st.menuOpen }))),
      setLangEE: this.setLangEE || (() => this.setState({ lang: 'EE' })),
      setLangRU: this.setLangRU || (() => this.setState({ lang: 'RU' })),
      setLangEN: this.setLangEN || (() => this.setState({ lang: 'EN' })),
      navLinks: navLinksByLang[lang] || navLinksByLang.EE,
      hoursText: hoursByLang[lang] || hoursByLang.EE,
      langActiveColorEE: lang === 'EE' ? active : idle,
      langActiveColorRU: lang === 'RU' ? active : idle,
      langActiveColorEN: lang === 'EN' ? active : idle,
      isEE: lang === 'EE',
      isRU: lang === 'RU',
      isEN: lang === 'EN',

      subtitleText: this.subtitleText,
      ctaText: this.ctaText,
      specs: this.specs,
      scrollToForm: this.scrollToForm,

      plate: s.plate,
      make: s.make,
      year: s.year,
      engine: s.engine,
      description: s.description,
      name: s.name,
      phone: s.phone,
      email: s.email,
      showManualFields: s.showManualFields,
      isSubmitting: s.isSubmitting,
      isSuccess: s.isSuccess,
      isError: s.isError,
      isFormVisible: !s.isSuccess,
      submitLabel: s.isSubmitting ? '[ SAATMINE... ]' : '[ SAADA HINNAPÄRING → ]',
      toggleManual: this.toggleManual,
      onPlateChange: this.onPlateChange,
      onMakeChange: this.onMakeChange,
      onYearChange: this.onYearChange,
      onEngineChange: this.onEngineChange,
      onDescriptionChange: this.onDescriptionChange,
      onNameChange: this.onNameChange,
      onPhoneChange: this.onPhoneChange,
      onEmailChange: this.onEmailChange,
      handleSubmit: this.handleSubmit,

      services: this.services,
      symptoms: this.symptoms,
      ticks: this.ticks,

      equipment: this.equipment,
      team: this.team,
      b2bPoints: this.b2bPoints,

      scrollToTop: this.scrollToTop,
      ...footerI18n,
      accentColor: (this.props && this.props.accentColor) || '#E63946',
      accent: (this.props && this.props.accentColor) || '#E63946',
      langClassRU: lang === 'RU' ? 'ft-lang-active' : 'ft-lang-muted',
      langClassEE: lang === 'EE' ? 'ft-lang-active' : 'ft-lang-muted',
      langClassEN: lang === 'EN' ? 'ft-lang-active' : 'ft-lang-muted',
      ink: '#171717',
      line: '#d4d4d4',
    };
  }
}

</script>
</body>
</html>
"@

$dest = Join-Path $here 'MainPage.dc.html'
[System.IO.File]::WriteAllText($dest, $out, [System.Text.UTF8Encoding]::new($false))
$item = Get-Item -LiteralPath $dest
Write-Host "Wrote $dest ($($item.Length) bytes)"
Write-Host "Order: $($ORDER -join ' → ')"

$content = Get-Content -LiteralPath $dest -Raw
foreach ($s in @(
  'Header.dc.html','Hero.dc.html','RequestForm.dc.html','ServicesSymptoms.dc.html',
  'EquipmentTeamB2B.dc.html','Footer.dc.html','class="hd"','class="hero"','class="rf"',
  'class="ss"','class="etb"','ft-premium'
)) {
  $n = ([regex]::Matches($content, [regex]::Escape($s))).Count
  Write-Host ("{0,-28} {1}" -f $s, $n)
}
