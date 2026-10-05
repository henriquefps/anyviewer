/* AnyViewer showcase. Every sample goes through the public API (AnyViewer.render); the event
   log shows what a host app (for example an OutSystems screen) receives. */
(function () {
    'use strict';

    const SAMPLES = 'samples/';
    const SCRIPTS = '../dist/';
    const qs = new URLSearchParams(location.search);
    const store = {
        get(k) { try { return localStorage.getItem('anyviewer.' + k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem('anyviewer.' + k, v); } catch (e) { /* private mode */ } }
    };
    let lang = qs.get('lang') || store.get('lang') || ((navigator.language || 'en').slice(0, 2) === 'pt' ? 'pt' : 'en');
    let current = null;          // scenario id
    let shown = null;            // { name, source, size, url? }
    let logCount = 0;
    let codeTab = 'js';
    const opts = { showToolbar: true, allowDownload: true, height: '100%', source: 'base64' };

    const STR = {
        en: {
            tagline: 'Preview any file in the browser. OutSystems-ready.',
            events: 'Events', clearLog: 'Clear', dropHere: 'Drop a file to preview it',
            credits: 'Created by <b>Henrique Silva</b>, Solutions Specialist at <b>Axians Low Code</b>. Built on <a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener">pdf.js</a>, <a href="https://sheetjs.com" target="_blank" rel="noopener">SheetJS</a>, <a href="https://github.com/VolodymyrBaydalka/docxjs" target="_blank" rel="noopener">docx-preview</a>, <a href="https://stuk.github.io/jszip/" target="_blank" rel="noopener">JSZip</a>, <a href="https://highlightjs.org" target="_blank" rel="noopener">highlight.js</a>, <a href="https://marked.js.org" target="_blank" rel="noopener">marked</a> and <a href="https://github.com/cure53/DOMPurify" target="_blank" rel="noopener">DOMPurify</a>. Sample files are fictitious.',
            documents: 'Documents', sheets: 'Spreadsheets', images: 'Images', archives: 'Archives', code: 'Code & data', web: 'Markdown & HTML', media: 'Audio & video', detect: 'Detection', yours: 'Your file', outsystems: 'OutSystems',
            documentsLead: 'PDF pages are drawn by pdf.js only when they scroll into view, so long files open fast. Word documents keep their page breaks, tables and colours.',
            sheetsLead: 'Excel, ODS and CSV with one tab per sheet. Very large sheets show the first 5,000 rows and say so. Cell content is escaped, never run.',
            imagesLead: 'PNG, JPEG, GIF, WebP, AVIF, BMP, ICO and SVG, with zoom. SVG is shown as an image, so scripts inside it never run.',
            archivesLead: 'Browse a ZIP archive and open any file inside it in a nested viewer: PDF, Excel, Word, images, code, even another ZIP.',
            codeLead: 'Source code with syntax highlighting for 36 languages, pretty-printed JSON, XML, logs and plain text, with a line-wrap toggle.',
            webLead: 'Markdown is rendered and sanitised with DOMPurify. HTML is shown in a sandboxed frame with no permissions: it looks right and runs nothing.',
            mediaLead: 'Audio and video play with the browser\'s own controls, from bytes in memory.',
            detectLead: 'The type comes from the extension, the MIME type and the file\'s first bytes. A file without an extension still opens; one the browser can\'t show gets a clear message and a download button.',
            yoursLead: 'Open a file from your device or drop it anywhere on the viewer. Nothing is uploaded: the file never leaves your browser.',
            outsystemsLead: 'AnyViewer is an OutSystems Reactive library: one block, a few inputs and two events. Pick any sample and this panel shows the block as you would configure it.',
            options: 'Options', toolbar: 'Toolbar', download: 'Download button', height: 'Height', fill: 'Fill', source: 'Source', samples: 'Samples',
            code_: 'Code', result: 'Result', type: 'Type', mime: 'MIME', size: 'Size', time: 'Time', status: 'Status', file: 'File',
            pickFile: 'Choose a file…', urlPlaceholder: 'https://… (same origin or CORS-enabled)', open: 'Open', rendered: 'rendered', error: 'error',
            privacy: 'Files you open are read in your browser only.',
            osBlock: 'Block inputs', osEvents: 'Events', osHow: 'How it works',
            osSteps: '<li>Import the scripts in <code>dist/</code> into the library and make them <b>Required Scripts</b> of the block.</li><li><code>OnReady</code> and <code>OnParametersChanged</code> call <code>AnyViewer.render</code> with the inputs.</li><li><code>OnDestroy</code> calls <code>AnyViewer.destroy</code>.</li><li>Libraries register on page load but only run when a file type first needs them.</li>',
            osNote: 'See docs/outsystems.md in the repository for the full block and the demo module.',
            d_report: 'Three pages, chart and table', d_proposal: 'Word, two pages with a table', d_sales: 'Three sheets, 6,200-row log', d_customers: 'Semicolons, accents, BOM',
            d_landscape: '960 × 600 PNG', d_chart: 'Vector, with a blocked script', d_project: 'Folders with PDF, Word, Excel…', d_cs: 'C# with highlighting', d_json: 'Minified, shown pretty-printed',
            d_xml: 'Configuration file', d_log: '400 lines of server log', d_readme: 'Tables, code, blocked HTML', d_invoice: 'Sandboxed, script blocked',
            d_chime: 'WAV, 4 seconds', d_clip: 'WebM, 5 seconds', d_scan: 'No extension: a PDF by its bytes', d_slides: 'Not supported: clear fallback'
        },
        pt: {
            tagline: 'Pré-visualize qualquer ficheiro no browser. Pronto para OutSystems.',
            events: 'Eventos', clearLog: 'Limpar', dropHere: 'Largue um ficheiro para o ver',
            credits: 'Criado por <b>Henrique Silva</b>, Solutions Specialist na <b>Axians Low Code</b>. Construído sobre <a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener">pdf.js</a>, <a href="https://sheetjs.com" target="_blank" rel="noopener">SheetJS</a>, <a href="https://github.com/VolodymyrBaydalka/docxjs" target="_blank" rel="noopener">docx-preview</a>, <a href="https://stuk.github.io/jszip/" target="_blank" rel="noopener">JSZip</a>, <a href="https://highlightjs.org" target="_blank" rel="noopener">highlight.js</a>, <a href="https://marked.js.org" target="_blank" rel="noopener">marked</a> e <a href="https://github.com/cure53/DOMPurify" target="_blank" rel="noopener">DOMPurify</a>. Os ficheiros de exemplo são fictícios.',
            documents: 'Documentos', sheets: 'Folhas de cálculo', images: 'Imagens', archives: 'Arquivos', code: 'Código e dados', web: 'Markdown e HTML', media: 'Áudio e vídeo', detect: 'Deteção', yours: 'O seu ficheiro', outsystems: 'OutSystems',
            documentsLead: 'As páginas de PDF são desenhadas pelo pdf.js só quando entram no ecrã, por isso ficheiros longos abrem depressa. Os documentos Word mantêm quebras de página, tabelas e cores.',
            sheetsLead: 'Excel, ODS e CSV com um separador por folha. Folhas muito grandes mostram as primeiras 5000 linhas e avisam. O conteúdo das células é escapado, nunca executado.',
            imagesLead: 'PNG, JPEG, GIF, WebP, AVIF, BMP, ICO e SVG, com zoom. O SVG é mostrado como imagem, por isso os scripts que contenha nunca correm.',
            archivesLead: 'Navegue num arquivo ZIP e abra qualquer ficheiro lá dentro num visualizador encaixado: PDF, Excel, Word, imagens, código, até outro ZIP.',
            codeLead: 'Código com realce de sintaxe para 36 linguagens, JSON formatado, XML, logs e texto simples, com quebra de linha opcional.',
            webLead: 'O Markdown é convertido e limpo com DOMPurify. O HTML aparece numa frame isolada sem permissões: fica com bom aspeto e não executa nada.',
            mediaLead: 'Áudio e vídeo tocam com os controlos do próprio browser, a partir dos bytes em memória.',
            detectLead: 'O tipo vem da extensão, do tipo MIME e dos primeiros bytes do ficheiro. Um ficheiro sem extensão abre na mesma; um que o browser não sabe mostrar recebe uma mensagem clara e um botão de download.',
            yoursLead: 'Abra um ficheiro do seu dispositivo ou largue-o em qualquer ponto do visualizador. Nada é enviado: o ficheiro nunca sai do browser.',
            outsystemsLead: 'O AnyViewer é uma biblioteca OutSystems Reactive: um bloco, alguns inputs e dois eventos. Escolha um exemplo e este painel mostra o bloco tal como o configuraria.',
            options: 'Opções', toolbar: 'Barra de ferramentas', download: 'Botão de download', height: 'Altura', fill: 'Encher', source: 'Origem', samples: 'Exemplos',
            code_: 'Código', result: 'Resultado', type: 'Tipo', mime: 'MIME', size: 'Tamanho', time: 'Tempo', status: 'Estado', file: 'Ficheiro',
            pickFile: 'Escolher ficheiro…', urlPlaceholder: 'https://… (mesma origem ou com CORS)', open: 'Abrir', rendered: 'mostrado', error: 'erro',
            privacy: 'Os ficheiros que abre são lidos apenas no seu browser.',
            osBlock: 'Inputs do bloco', osEvents: 'Eventos', osHow: 'Como funciona',
            osSteps: '<li>Importe os scripts de <code>dist/</code> para a biblioteca e torne-os <b>Required Scripts</b> do bloco.</li><li><code>OnReady</code> e <code>OnParametersChanged</code> chamam <code>AnyViewer.render</code> com os inputs.</li><li><code>OnDestroy</code> chama <code>AnyViewer.destroy</code>.</li><li>As bibliotecas registam-se ao carregar a página mas só correm quando um tipo de ficheiro precisa delas.</li>',
            osNote: 'Veja docs/outsystems.md no repositório para o bloco completo e o módulo de demonstração.',
            d_report: 'Três páginas, gráfico e tabela', d_proposal: 'Word, duas páginas com tabela', d_sales: 'Três folhas, log de 6200 linhas', d_customers: 'Ponto e vírgula, acentos, BOM',
            d_landscape: 'PNG 960 × 600', d_chart: 'Vetorial, com script bloqueado', d_project: 'Pastas com PDF, Word, Excel…', d_cs: 'C# com realce', d_json: 'Minificado, mostrado formatado',
            d_xml: 'Ficheiro de configuração', d_log: '400 linhas de log de servidor', d_readme: 'Tabelas, código, HTML bloqueado', d_invoice: 'Isolado, script bloqueado',
            d_chime: 'WAV, 4 segundos', d_clip: 'WebM, 5 segundos', d_scan: 'Sem extensão: um PDF pelos bytes', d_slides: 'Não suportado: alternativa clara'
        }
    };
    const t = k => (STR[lang] && STR[lang][k]) || STR.en[k] || k;

    const SCENARIOS = {
        documents: [['report.pdf', 'd_report'], ['proposal.docx', 'd_proposal']],
        sheets: [['sales.xlsx', 'd_sales'], ['customers.csv', 'd_customers']],
        images: [['landscape.png', 'd_landscape'], ['chart.svg', 'd_chart']],
        archives: [['project.zip', 'd_project']],
        code: [['OrderService.cs', 'd_cs'], ['api-response.json', 'd_json'], ['settings.xml', 'd_xml'], ['server.log', 'd_log']],
        web: [['README.md', 'd_readme'], ['invoice.html', 'd_invoice']],
        media: [['chime.wav', 'd_chime'], ['clip.webm', 'd_clip']],
        detect: [['scan', 'd_scan'], ['slides.pptx', 'd_slides']],
        yours: null,
        outsystems: null
    };
    const ALL_SAMPLES = [].concat(...Object.values(SCENARIOS).filter(Boolean));

    const $ = id => document.getElementById(id);
    const h = (tag, attrs, children) => {
        const e = document.createElement(tag);
        Object.entries(attrs || {}).forEach(([k, v]) => {
            if (k === 'on') Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn));
            else if (k === 'text') e.textContent = v;
            else if (k === 'html') e.innerHTML = v;
            else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
        });
        (children || []).forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
        return e;
    };
    const group = (title, children) => h('div', { class: 'group' }, [title ? h('h3', { text: title }) : null].concat(children));
    const fmtSize = n => n == null ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
    const extOf = name => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1] || '';

    /* ---------------- event log ---------------- */
    function log(type, payload, isError) {
        logCount++;
        $('log-count').textContent = String(logCount);
        const li = h('li', {}, [h('b', { class: isError ? 'err' : '', text: type }), h('span', { text: ' ' + JSON.stringify(payload) })]);
        $('log').prepend(li);
        while ($('log').children.length > 80) $('log').lastChild.remove();
    }

    /* ---------------- rendering ---------------- */
    function toBase64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
    }

    // file: { name, bytes?, url?, mimeType?, size? }
    async function show(file) {
        shown = { name: file.name, size: file.size, url: file.url, sample: !!file.sample, status: null };
        const o = {
            fileName: file.name, mimeType: file.mimeType || '', height: opts.height,
            showToolbar: opts.showToolbar, allowDownload: opts.allowDownload, scriptsBaseUrl: SCRIPTS
        };
        if (file.bytes) o.base64 = toBase64(file.bytes);
        else if (file.url && opts.source === 'url') o.url = file.url;
        else if (file.url) {
            const r = await fetch(file.url);
            const bytes = new Uint8Array(await r.arrayBuffer());
            shown.size = bytes.length;
            o.base64 = toBase64(bytes);
        }
        shown.source = o.base64 ? 'base64' : 'url';
        const started = performance.now();
        o.onRendered = type => {
            Object.assign(shown, { status: 'ok', type, ms: Math.round(performance.now() - started) });
            log('OnRendered', { DetectedType: type, ms: shown.ms });
            refreshCards();
        };
        o.onError = msg => {
            Object.assign(shown, { status: 'error', error: msg, ms: Math.round(performance.now() - started) });
            log('OnError', { ErrorMessage: msg }, true);
            refreshCards();
        };
        if (o.base64) {
            const d = AnyViewer.detect(file.name, file.mimeType, Uint8Array.from(atob(o.base64.slice(0, 5464)), c => c.charCodeAt(0)));
            Object.assign(shown, { type: d.kind, mime: d.mime });
            shown.size = shown.size || Math.floor(o.base64.length * 3 / 4);
        }
        log('render', { fileName: file.name || '(none)', source: shown.source });
        refreshCards();
        AnyViewer.destroy('viewer');
        document.querySelectorAll('.file').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.file === file.name && file.sample)));
        return AnyViewer.render('viewer', o);
    }

    function showSample(name) {
        const u = new URL(location.href);
        u.searchParams.set('file', name);
        history.replaceState(null, '', u);
        return show({ name, url: SAMPLES + encodeURIComponent(name), sample: true });
    }

    function rerender() {
        if (!shown) return;
        if (shown.sample) showSample(shown.name);
        else if (lastUserFile) show(lastUserFile);
    }

    /* ---------------- panel parts ---------------- */
    function filesList(list) {
        return h('div', { class: 'files' }, list.map(([name, desc]) => {
            const ext = extOf(name);
            return h('button', { type: 'button', class: 'file', 'data-file': name, 'aria-pressed': String(!!shown && shown.sample && shown.name === name), on: { click: () => showSample(name) } }, [
                h('span', { class: 'ext' + (ext ? '' : ' alt'), text: ext || '?' }),
                h('span', { class: 'meta' }, [h('b', { text: name }), h('small', { text: t(desc) })])
            ]);
        }));
    }

    function checkbox(label, key) {
        return h('div', { class: 'opt' }, [h('label', {}, [
            h('input', { type: 'checkbox', checked: opts[key], on: { change: e => { opts[key] = e.target.checked; rerender(); } } }),
            label
        ])]);
    }
    function segmented(label, key, choices) {
        const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label }, choices.map(([v, text]) =>
            h('button', { type: 'button', 'aria-pressed': String(opts[key] === v), text, on: { click: () => {
                opts[key] = v;
                seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(choices[i][0] === v)));
                rerender();
            } } })));
        return h('div', { class: 'opt' }, [h('span', { text: label }), seg]);
    }
    function optionsGroup(withSource) {
        return group(t('options'), [h('div', { class: 'opts' }, [
            checkbox(t('toolbar'), 'showToolbar'),
            checkbox(t('download'), 'allowDownload'),
            segmented(t('height'), 'height', [['100%', t('fill')], ['600px', '600px'], ['400px', '400px']]),
            withSource ? segmented(t('source'), 'source', [['base64', 'Base64'], ['url', 'URL']]) : null
        ])]);
    }

    const cards = h('div');
    function resultCard() {
        if (!shown) return null;
        const status = shown.status === 'ok' ? h('span', { class: 'status-ok', text: t('rendered') })
            : shown.status === 'error' ? h('span', { class: 'status-bad', text: t('error') + ': ' + shown.error }) : h('span', { text: '…' });
        const rows = [[t('file'), shown.name || '(none)'], [t('type'), shown.type || ''], [t('mime'), shown.mime || ''], [t('size'), fmtSize(shown.size)],
            [t('source'), shown.source], [t('time'), shown.ms != null ? shown.ms + ' ms' : '']];
        return h('div', { class: 'card' }, [h('h4', { text: t('result') }), h('dl', {}, rows.filter(r => r[1]).map(r => [h('dt', { text: r[0] }), h('dd', { text: r[1] })]).flat()
            .concat([h('dt', { text: t('status') }), h('dd', {}, [status])]))]);
    }
    function jsCode() {
        const name = shown ? shown.name : 'report.pdf';
        const src = shown && shown.source === 'url' ? `  url: ${JSON.stringify(shown.url)},` : '  base64: fileAsBase64,';
        return [
            '<script src="dist/anyviewer.js"></script>',
            '',
            "AnyViewer.render('viewer', {",
            src,
            `  fileName: ${JSON.stringify(name)},`,
            `  height: ${JSON.stringify(opts.height)},`,
            `  showToolbar: ${opts.showToolbar},`,
            `  allowDownload: ${opts.allowDownload},`,
            "  scriptsBaseUrl: 'dist/',",
            '  onRendered: type => console.log(type),',
            '  onError: message => console.error(message)',
            '});'
        ].join('\n');
    }
    function osCode() {
        const name = shown ? shown.name : 'report.pdf';
        const url = shown && shown.source === 'url';
        const b = v => (v ? 'True' : 'False');
        return [
            'AnyViewer block',
            `  FileContent   = ${url ? '(empty)' : 'GetFile.List.Current.File.Content'}`,
            `  FileUrl       = ${url ? JSON.stringify(shown.url) : '""'}`,
            `  FileName      = ${JSON.stringify(name)}`,
            `  Height        = ${JSON.stringify(opts.height)}`,
            `  ShowToolbar   = ${b(opts.showToolbar)}`,
            `  AllowDownload = ${b(opts.allowDownload)}`,
            '',
            `  OnRendered(DetectedType)  ${shown && shown.type ? '→ "' + shown.type + '"' : ''}`,
            '  OnError(ErrorMessage)'
        ].join('\n');
    }
    function codeCard() {
        const pre = h('pre', { text: codeTab === 'js' ? jsCode() : osCode() });
        const tabs = h('div', { class: 'tabs' }, [['js', 'JavaScript'], ['os', 'OutSystems']].map(([id, label]) =>
            h('button', { type: 'button', 'aria-pressed': String(codeTab === id), text: label, on: { click: () => { codeTab = id; refreshCards(); } } })));
        return h('div', { class: 'card' }, [h('h4', { text: t('code_') }), tabs, pre]);
    }
    function refreshCards() {
        cards.innerHTML = '';
        if (current === 'outsystems') codeTab = 'os';
        [resultCard(), codeCard()].forEach(c => c && cards.appendChild(c));
    }

    /* ---------------- your own file ---------------- */
    let lastUserFile = null;
    async function openUserFile(f) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        lastUserFile = { name: f.name, mimeType: f.type, bytes, size: f.size };
        const u = new URL(location.href);
        u.searchParams.delete('file');
        history.replaceState(null, '', u);
        return show(lastUserFile);
    }
    function yoursPanel() {
        const input = h('input', { type: 'file', hidden: true, on: { change: e => e.target.files[0] && openUserFile(e.target.files[0]) } });
        const url = h('input', { type: 'url', placeholder: t('urlPlaceholder'), 'aria-label': 'URL' });
        const openUrl = () => {
            if (!url.value.trim()) return;
            lastUserFile = null;
            const saved = opts.source;
            opts.source = 'url';
            show({ name: '', url: url.value.trim() }).finally(() => { opts.source = saved; });
        };
        url.addEventListener('keydown', e => { if (e.key === 'Enter') openUrl(); });
        return [
            group(null, [h('div', { class: 'pick' }, [
                h('button', { type: 'button', class: 'btn', text: t('pickFile'), on: { click: () => input.click() } }), input,
                h('div', { class: 'url-row' }, [url, h('button', { type: 'button', class: 'btn secondary', text: t('open'), on: { click: openUrl } })])
            ])]),
            h('div', { class: 'note', text: t('privacy') }),
            optionsGroup(false)
        ];
    }

    function outsystemsPanel() {
        return [
            group(t('samples'), [filesList(ALL_SAMPLES.slice(0, 6))]),
            group(t('osHow'), [h('ol', { class: 'note', style: 'padding-left:18px;margin:0', html: t('osSteps') })]),
            optionsGroup(true),
            h('div', { class: 'note', text: t('osNote') })
        ];
    }

    /* ---------------- scenarios ---------------- */
    function open(id) {
        current = id;
        document.querySelectorAll('#scenarios button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
        const panel = $('panel');
        panel.innerHTML = '';
        panel.appendChild(h('h2', { text: t(id) }));
        panel.appendChild(h('p', { class: 'lead', text: t(id + 'Lead') }));
        let parts;
        if (id === 'yours') parts = yoursPanel();
        else if (id === 'outsystems') parts = outsystemsPanel();
        else parts = [group(t('samples'), [filesList(SCENARIOS[id])]), optionsGroup(true)];
        parts.forEach(p => panel.appendChild(p));
        panel.appendChild(cards);
        if (id !== 'outsystems' && codeTab === 'os' && !qs.get('code')) codeTab = 'js';
        refreshCards();
        const list = SCENARIOS[id];
        if (list && !(shown && shown.sample && list.some(s => s[0] === shown.name))) showSample(list[0][0]);
        if (id === 'outsystems' && !shown) showSample('report.pdf');
    }

    function renderStatic() {
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
        document.querySelectorAll('[data-t-html]').forEach(e => { e.innerHTML = t(e.dataset.tHtml); });
        const nav = $('scenarios');
        nav.innerHTML = '';
        Object.keys(SCENARIOS).forEach(id => nav.appendChild(h('button', { type: 'button', 'data-id': id, text: t(id), on: { click: () => open(id) } })));
    }

    /* ---------------- drag and drop ---------------- */
    let dragDepth = 0;
    const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    document.addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; $('drop').hidden = false; } });
    document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').hidden = true; } });
    document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    document.addEventListener('drop', e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth = 0;
        $('drop').hidden = true;
        const f = e.dataTransfer.files[0];
        if (!f) return;
        if (current !== 'yours') open('yours');
        openUserFile(f);
    });

    /* ---------------- start ---------------- */
    $('lang').value = lang;
    $('lang').addEventListener('change', e => {
        lang = e.target.value;
        store.set('lang', lang);
        renderStatic();
        open(current);
    });
    $('log-clear').addEventListener('click', () => { $('log').innerHTML = ''; logCount = 0; $('log-count').textContent = '0'; });
    if (window.matchMedia('(min-width: 861px)').matches) $('log-box').open = true;

    renderStatic();
    const wanted = qs.get('file');
    const start = qs.get('scenario') || (wanted && Object.keys(SCENARIOS).find(id => SCENARIOS[id] && SCENARIOS[id].some(s => s[0] === wanted))) || 'documents';
    if (wanted && SCENARIOS[start] && SCENARIOS[start].some(s => s[0] === wanted)) shown = { name: wanted, sample: true };
    open(SCENARIOS[start] !== undefined ? start : 'documents');
    if (shown && shown.sample && !shown.source) showSample(shown.name);
    window.demo = { show, showSample, open };
})();
