/**
 * Assemble MainPage.dc.html from section prototypes.
 * Order: Header → Hero → RequestForm → ServicesSymptoms → EquipmentTeamB2B → Footer
 *
 *   node _build-main-page.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ORDER = [
  'Header.dc.html',
  'Hero.dc.html',
  'RequestForm.dc.html',
  'ServicesSymptoms.dc.html',
  'EquipmentTeamB2B.dc.html',
  'Footer.dc.html',
]

function extractBetween(src, openRe, closeStr) {
  const m = openRe.exec(src)
  if (!m) return null
  const start = m.index + m[0].length
  const close = src.lastIndexOf(closeStr)
  if (close < start) return null
  return src.slice(start, close)
}

function extractTemplate(src, file) {
  // Prefer <x-dc>...</x-dc>
  let t = extractBetween(src, /<x-dc(?:\s[^>]*)?>/i, '</x-dc>')
  if (t != null) return t.trim()
  // Fallback: body
  t = extractBetween(src, /<body(?:\s[^>]*)?>/i, '</body>')
  if (t != null) {
    // strip outer scripts
    t = t.replace(/<script[\s\S]*?<\/script>/gi, '')
    return t.trim()
  }
  throw new Error(`${file}: cannot extract template`)
}

function extractClassInner(src, file) {
  const script = extractBetween(
    src,
    /<script\b[^>]*data-dc-script[^>]*>/i,
    '</script>',
  )
  if (!script) {
    console.warn(`${file}: no data-dc-script`)
    return ''
  }
  const classMatch = /class\s+Component\s+extends\s+DCLogic\s*\{/.exec(script)
  if (!classMatch) {
    console.warn(`${file}: no Component class`)
    return script.trim()
  }
  const openBrace = script.indexOf('{', classMatch.index)
  let depth = 0
  for (let i = openBrace; i < script.length; i++) {
    const ch = script[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return script.slice(openBrace + 1, i).trim()
    }
  }
  throw new Error(`${file}: unclosed Component class`)
}

function stripRedeclarations(inner, file) {
  let s = inner
  // Remove renderVals entirely (we build a unified one)
  s = s.replace(
    /renderVals\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n  \}/g,
    '/* renderVals → unified */',
  )
  s = s.replace(
    /renderVals\s*\(\)\s*\{[\s\S]*?\n  \}/g,
    '/* renderVals → unified */',
  )
  // Remove state / ticks / scroll helpers (unified below)
  s = s.replace(/state\s*=\s*\{[\s\S]*?\n  \};/g, '/* state → unified */')
  s = s.replace(
    /ticks\s*=\s*Array\.from\(\{\s*length:\s*\d+\s*\}\);/g,
    '/* ticks → unified */',
  )
  s = s.replace(
    /scrollToForm\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n  \};/g,
    '/* scrollToForm → unified */',
  )
  s = s.replace(
    /scrollToTop\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n  \};/g,
    '/* scrollToTop → unified */',
  )
  return `  /* --- from ${file} --- */\n${s.trim()}`
}

const parts = ORDER.map((file) => {
  const raw = fs.readFileSync(path.join(__dirname, file), 'utf8')
  const template = extractTemplate(raw, file)
  const classInner = extractClassInner(raw, file)
  console.log(
    `OK ${file}: template ${template.length} chars, class ${classInner.length} chars`,
  )
  if (template.length < 200) {
    throw new Error(`${file}: template too short (${template.length})`)
  }
  return { file, template, classInner }
})

const templates = parts
  .map((p) => `<!-- ══ ${p.file} ══ -->\n${p.template}`)
  .join('\n\n')

const members = parts.map((p) => stripRedeclarations(p.classInner, p.file)).join('\n\n')

const out = `<!DOCTYPE html>
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

${templates}

</x-dc>
<script type="text/x-dc" data-dc-script data-props="{&quot;$preview&quot;:{&quot;width&quot;:1440,&quot;height&quot;:5600}}">
class Component extends DCLogic {
${members}

  /* ── Unified state & shared handlers ── */
  state = {
    menuOpen: false,
    lang: 'EE',
    // RequestForm
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

    // Footer i18n map if present (Footer.dc.html)
    const footerI18n =
      (this.i18n && (this.i18n[lang] || this.i18n.EE || this.i18n.RU)) || {};

    return {
      // Header
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

      // Hero
      subtitleText: this.subtitleText,
      ctaText: this.ctaText,
      specs: this.specs,
      scrollToForm: this.scrollToForm,

      // RequestForm fields + handlers
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

      // ServicesSymptoms
      services: this.services,
      symptoms: this.symptoms,
      ticks: this.ticks,

      // Equipment / Team / B2B
      equipment: this.equipment,
      team: this.team,
      b2bPoints: this.b2bPoints,

      // Footer
      scrollToTop: this.scrollToTop,
      ...footerI18n,
      accentColor: (this.props && this.props.accentColor) || '#E63946',
      accent: (this.props && this.props.accentColor) || '#E63946',
      langClassRU: lang === 'RU' ? 'ft-lang-active' : 'ft-lang-muted',
      langClassEE: lang === 'EE' ? 'ft-lang-active' : 'ft-lang-muted',
      langClassEN: lang === 'EN' ? 'ft-lang-active' : 'ft-lang-muted',
      langActiveColorFooterRU: lang === 'RU' ? '#ffffff' : '#737373',
      langActiveColorFooterEE: lang === 'EE' ? '#ffffff' : '#737373',
      ink: '#171717',
      line: '#d4d4d4',
    };
  }
}

</script>
</body>
</html>
`

const dest = path.join(__dirname, 'MainPage.dc.html')
fs.writeFileSync(dest, out, 'utf8')
console.log('Wrote', dest)
console.log('Size:', out.length, 'chars /', Buffer.byteLength(out, 'utf8'), 'bytes')
console.log('Order:', ORDER.join(' → '))
