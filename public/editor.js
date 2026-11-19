/* Engineeria Africa — rich story editor (built on Quill 2)
   Images with captions, YouTube/Vimeo, uploaded video & audio, tables and full formatting,
   placed anywhere inside the story. Exposes window.EAEditor.create(el, html, opts). */
(function () {
  'use strict';
  const Q = window.Quill;
  const BlockEmbed = Q.import('blots/block/embed');
  const escA = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function embedUrl(url) {
    let m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
    return null;
  }

  /* ---------- custom blocks ---------- */
  class Figure extends BlockEmbed {
    static create(v) {
      const n = super.create();
      n.classList.add('ea-size-' + (['full', 'medium', 'small'].includes(v.size) ? v.size : 'full'));
      if (v.align === 'left' || v.align === 'right') n.classList.add('ea-float-' + v.align);
      n.setAttribute('contenteditable', 'false');
      const img = document.createElement('img');
      img.setAttribute('src', v.src); img.setAttribute('alt', v.alt || ''); img.setAttribute('loading', 'lazy');
      n.appendChild(img);
      if (v.caption) { const c = document.createElement('figcaption'); c.textContent = v.caption; n.appendChild(c); }
      return n;
    }
    static value(n) {
      const img = n.querySelector('img'), cls = [...n.classList];
      return {
        src: img ? img.getAttribute('src') : '', alt: img ? img.getAttribute('alt') || '' : '',
        caption: n.querySelector('figcaption')?.textContent || '',
        size: (cls.find(c => c.startsWith('ea-size-')) || 'ea-size-full').slice(8),
        align: (cls.find(c => c.startsWith('ea-float-')) || '').slice(9),
      };
    }
  }
  Figure.blotName = 'eafigure'; Figure.tagName = 'FIGURE'; Figure.className = 'ea-fig';

  class EmbedVideo extends BlockEmbed {
    static create(url) {
      const n = super.create(); n.setAttribute('contenteditable', 'false');
      const f = document.createElement('iframe');
      f.setAttribute('src', url); f.setAttribute('allowfullscreen', 'true'); f.setAttribute('frameborder', '0');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      n.appendChild(f); return n;
    }
    static value(n) { return n.querySelector('iframe')?.getAttribute('src') || ''; }
  }
  EmbedVideo.blotName = 'eavideo'; EmbedVideo.tagName = 'DIV'; EmbedVideo.className = 'ea-embed';

  class FileVideo extends BlockEmbed {
    static create(src) {
      const n = super.create(); n.setAttribute('contenteditable', 'false');
      const v = document.createElement('video');
      v.setAttribute('src', src); v.setAttribute('controls', ''); v.setAttribute('preload', 'metadata'); v.setAttribute('playsinline', '');
      n.appendChild(v); return n;
    }
    static value(n) { return n.querySelector('video')?.getAttribute('src') || ''; }
  }
  FileVideo.blotName = 'eafilevideo'; FileVideo.tagName = 'DIV'; FileVideo.className = 'ea-vfile';

  class FileAudio extends BlockEmbed {
    static create(v) {
      const n = super.create(); n.setAttribute('contenteditable', 'false');
      if (v.title) { const t = document.createElement('div'); t.className = 'ea-atitle'; t.textContent = v.title; n.appendChild(t); }
      const a = document.createElement('audio');
      a.setAttribute('src', v.src); a.setAttribute('controls', ''); a.setAttribute('preload', 'none');
      n.appendChild(a); return n;
    }
    static value(n) { return { src: n.querySelector('audio')?.getAttribute('src') || '', title: n.querySelector('.ea-atitle')?.textContent || '' }; }
  }
  FileAudio.blotName = 'eaaudio'; FileAudio.tagName = 'DIV'; FileAudio.className = 'ea-afile';

  class Divider extends BlockEmbed { }
  Divider.blotName = 'eahr'; Divider.tagName = 'HR';

  Q.register({ 'formats/eafigure': Figure, 'formats/eavideo': EmbedVideo, 'formats/eafilevideo': FileVideo, 'formats/eaaudio': FileAudio, 'formats/eahr': Divider }, true);

  const icons = Q.import('ui/icons');
  icons.audio = '<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M7 13.5V4.2l7-1.7v9.3"/><circle class="ql-stroke" cx="5" cy="13.5" r="2"/><circle class="ql-stroke" cx="12" cy="11.8" r="2"/></svg>';
  icons.hr = '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="2" x2="16" y1="9" y2="9"/><line class="ql-stroke ql-thin" x1="5" x2="13" y1="4" y2="4" stroke-dasharray="1 2"/><line class="ql-stroke ql-thin" x1="5" x2="13" y1="14" y2="14" stroke-dasharray="1 2"/></svg>';
  icons.table = '<svg viewBox="0 0 18 18"><rect class="ql-stroke" x="2.5" y="3.5" width="13" height="11" rx="1"/><line class="ql-stroke" x1="2.5" x2="15.5" y1="7.5" y2="7.5"/><line class="ql-stroke" x1="2.5" x2="15.5" y1="11" y2="11"/><line class="ql-stroke" x1="7" x2="7" y1="3.5" y2="14.5"/><line class="ql-stroke" x1="11.3" x2="11.3" y1="3.5" y2="14.5"/></svg>';
  icons.undo = '<svg viewBox="0 0 18 18"><polygon class="ql-fill ql-stroke" points="6 10 4 12 2 10 6 10"/><path class="ql-stroke" d="M8.09,13.91A4.6,4.6,0,0,0,9,14,5,5,0,1,0,4,9"/></svg>';
  icons.redo = '<svg viewBox="0 0 18 18"><polygon class="ql-fill ql-stroke" points="12 10 14 12 16 10 12 10"/><path class="ql-stroke" d="M9.91,13.91A4.6,4.6,0,0,1,9,14a5,5,0,1,1,5-5"/></svg>';
  icons.fullscreen = '<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M3 7V3h4M15 7V3h-4M3 11v4h4M15 11v4h-4"/></svg>';

  /* ---------- small modal dialog ---------- */
  function dialog(title, bodyHTML, okLabel = 'Insert') {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'ea-modal';
      wrap.innerHTML = `<div class="ea-modal-bg"></div><form class="ea-modal-box"><h3>${title}</h3>${bodyHTML}<div class="ea-modal-err"></div><div class="btns" style="margin-top:16px"><button class="btn pri" type="submit">${okLabel}</button><button class="btn" type="button" data-x>Cancel</button></div></form>`;
      document.body.appendChild(wrap);
      const form = wrap.querySelector('form');
      const close = v => { wrap.remove(); resolve(v); };
      wrap.querySelector('[data-x]').onclick = () => close(null);
      wrap.querySelector('.ea-modal-bg').onclick = () => close(null);
      form.onkeydown = e => { if (e.key === 'Escape') close(null); };
      form.onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(form);
        if (form._validate) { const err = await form._validate(fd); if (err) { form.querySelector('.ea-modal-err').innerHTML = `<div class="err">${escA(err)}</div>`; return; } }
        close(Object.fromEntries(fd));
      };
      form._wrap = wrap;
      setTimeout(() => form.querySelector('input:not([type=hidden]),select,textarea')?.focus(), 30);
      dialog.last = form;
    });
  }
  // file field inside a dialog that uploads immediately and fills a hidden input
  function uploadField(name, accept, kind, label, opts) {
    return `<label>${label}</label><input type="file" accept="${accept}" data-dlg-up="${kind}" data-name="${name}"><input type="hidden" name="${name}"><div class="ea-dlg-prev" data-prev="${name}"></div>`;
  }
  function wireUploads(form, opts) {
    form.querySelectorAll('[data-dlg-up]').forEach(inp => {
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        const kind = inp.dataset.dlgUp, name = inp.dataset.name, prev = form.querySelector(`[data-prev="${name}"]`);
        const L = opts.limits || {}, maxMB = kind === 'video' ? L.videoMaxMB : kind === 'audio' ? L.audioMaxMB : L.imgMaxMB;
        if (maxMB && f.size > maxMB * 1e6) { prev.innerHTML = `<div class="err">${escA(f.name)} is ${(f.size / 1e6).toFixed(1)} MB — the limit is ${maxMB} MB.</div>`; inp.value = ''; return; }
        prev.innerHTML = `<div class="hint">Uploading ${escA(f.name)}…</div><div class="progress"><i></i></div>`;
        const btn = form.querySelector('[type=submit]'); btn.disabled = true;
        try {
          const url = await opts.upload(f, kind, p => { const b = prev.querySelector('.progress i'); if (b) b.style.width = Math.round(p * 100) + '%'; });
          form.querySelector(`[name="${name}"]`).value = url;
          prev.innerHTML = kind === 'image' ? `<img src="${escA(url)}" alt="">` : `<div class="hint">✓ ${escA(f.name)} uploaded</div>`;
        } catch (e) { prev.innerHTML = `<div class="err">${escA(e.message)}</div>`; }
        btn.disabled = false;
      };
    });
  }

  /* ---------- editor ---------- */
  function create(container, html, opts) {
    container.innerHTML = '<div class="ea-editor"></div><div class="ea-table-bar" hidden></div><div class="ea-status"></div>';
    const host = container.querySelector('.ea-editor');
    const quill = new Q(host, {
      theme: 'snow',
      placeholder: 'Write the story here… Use the toolbar to add headings, images, videos, audio, tables and more.',
      modules: {
        table: true,
        keyboard: {
          bindings: {
            'table tab': { key: 'Tab', shiftKey: null, format: ['table'], handler(range, ctx) { return moveCell(range, ctx.event.shiftKey ? -1 : 1); } },
          },
        },
        history: { delay: 800, maxStack: 200, userOnly: true },
        toolbar: {
          container: [
            [{ header: [2, 3, 4, false] }], [{ size: ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike'], [{ color: [] }, { background: [] }], [{ script: 'sub' }, { script: 'super' }],
            [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }], [{ indent: '-1' }, { indent: '+1' }], [{ align: [] }],
            ['blockquote', 'code-block'], ['link', 'image', 'video', 'audio', 'table', 'hr'], ['clean'], ['undo', 'redo', 'fullscreen'],
          ],
          handlers: {
            image: () => insertImage(), video: () => insertVideo(), audio: () => insertAudio(),
            table: () => { quill.getModule('table').insertTable(3, 3); quill.focus(); },
            hr: () => insertBlock('eahr', true),
            undo: () => quill.history.undo(), redo: () => quill.history.redo(),
            fullscreen: () => { container.classList.toggle('ea-full'); document.body.classList.toggle('ea-full-open', container.classList.contains('ea-full')); quill.focus(); },
          },
        },
        uploader: {  // dropped or pasted image files are uploaded, never stored inside the text
          mimetypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
          handler: async (range, files) => {
            for (const f of files) {
              try { opts.toast?.('Uploading ' + f.name + '…'); const url = await opts.upload(f, 'image'); insertBlock('eafigure', { src: url, size: 'full' }, range); }
              catch (e) { opts.toast?.(e.message); }
            }
          },
        },
        clipboard: {
          matchers: [['IMG', (node, delta) => (/^data:/i.test(node.getAttribute('src') || '') ? new (Q.import('delta'))() : delta)]],
        },
      },
    });
    // tooltips on toolbar buttons
    const tips = { bold: 'Bold (Ctrl+B)', italic: 'Italic (Ctrl+I)', underline: 'Underline (Ctrl+U)', strike: 'Strikethrough', link: 'Insert link', image: 'Insert image with caption', video: 'Insert video (YouTube, Vimeo or upload)', audio: 'Insert audio', table: 'Insert table', hr: 'Insert divider line', blockquote: 'Quote', 'code-block': 'Code / formula block', clean: 'Remove formatting', undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y)', fullscreen: 'Full-screen writing', color: 'Text colour', background: 'Highlight colour' };
    container.querySelectorAll('.ql-toolbar button, .ql-toolbar .ql-picker').forEach(b => {
      const k = [...b.classList].find(c => c.startsWith('ql-') && c !== 'ql-picker' && c !== 'ql-color-picker' && c !== 'ql-icon-picker')?.slice(3);
      const v = b.value ? ` (${b.value})` : '';
      if (k && tips[k]) b.setAttribute('title', tips[k]); else if (k === 'list') b.setAttribute('title', { ordered: 'Numbered list', bullet: 'Bullet list', check: 'Checklist' }[b.value] || 'List');
      else if (k === 'indent') b.setAttribute('title', b.value === '+1' ? 'Indent' : 'Outdent');
      else if (k === 'script') b.setAttribute('title', b.value === 'sub' ? 'Subscript (e.g. H₂O)' : 'Superscript (e.g. m²)');
      else if (k === 'header') b.setAttribute('title', 'Heading'); else if (k === 'size') b.setAttribute('title', 'Text size'); else if (k === 'align') b.setAttribute('title', 'Alignment');
      void v;
    });

    // Tab / Shift+Tab move between table cells; Tab in the last cell adds a new row
    function moveCell(range, dir) {
      const tm = quill.getModule('table'), [table, , cell] = tm.getTable(range);
      if (!table || !cell) return true;
      const cells = () => [...table.domNode.querySelectorAll('td')];
      let i = cells().indexOf(cell.domNode) + dir;
      if (i < 0) return false;
      if (i >= cells().length) { tm.insertRowBelow(); i = cells().indexOf(cell.domNode) + 1; }
      const next = Q.find(cells()[i]);
      if (next) quill.setSelection(quill.getIndex(next), 0, 'user');
      return false;
    }
    function insertBlock(type, value, range) {
      let r = range || quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      if (quill.getFormat(r.index, 0).table) {  // never put media inside a table: go just below it
        const [table] = quill.getModule('table').getTable(r);
        if (table) r = { index: quill.getIndex(table) + table.length(), length: 0 };
      }
      let i = r.index;
      if (r.length) quill.deleteText(r.index, r.length, 'user');
      const [line, off] = quill.getLine(i);
      if (off > 0 && line) { quill.insertText(i, '\n', 'user'); i++; }  // start the media on its own line
      quill.insertEmbed(i, type, value, 'user');
      quill.setSelection(i + 1, 0, 'silent');
      if (i + 1 >= quill.getLength() - 1) quill.insertText(i + 1, '\n', 'user');
      quill.setSelection(i + 1, 0, 'user');
    }
    async function insertImage() {
      const range = quill.getSelection(true);
      const p = dialog('Insert image', `${uploadField('src', 'image/*', 'image', 'Upload an image')}
        <label>…or paste an image link</label><input name="link" type="url" placeholder="https://">
        <label>Caption (shown under the image)</label><input name="caption" maxlength="300" placeholder="e.g. The completed deck of the bridge, March 2027">
        <label>Description for screen readers (alt text)</label><input name="alt" maxlength="200">
        <div class="grid2"><div><label>Size</label><select name="size"><option value="full">Full width</option><option value="medium">Medium</option><option value="small">Small</option></select></div>
        <div><label>Position</label><select name="align"><option value="">Centre</option><option value="left">Left, text wraps around</option><option value="right">Right, text wraps around</option></select></div></div>`);
      const form = dialog.last; wireUploads(form, opts);
      form._validate = fd => (!fd.get('src') && !/^https:\/\//.test(fd.get('link') || '')) ? 'Upload an image or paste an https:// link.' : null;
      const v = await p; if (!v) return;
      insertBlock('eafigure', { src: v.src || v.link, caption: v.caption, alt: v.alt || v.caption, size: v.size, align: v.align }, range);
    }
    async function insertVideo() {
      const range = quill.getSelection(true);
      const p = dialog('Insert video', `<label>YouTube or Vimeo link</label><input name="link" type="url" placeholder="https://www.youtube.com/watch?v=…">
        <div class="hint" style="margin:10px 0">or</div>${uploadField('file', 'video/mp4,video/webm,video/quicktime', 'video', 'Upload a video file (MP4 / WebM)')}`);
      const form = dialog.last; wireUploads(form, opts);
      form._validate = fd => fd.get('file') || embedUrl(fd.get('link')) ? null : 'Paste a YouTube or Vimeo link, or upload a video file.';
      const v = await p; if (!v) return;
      if (v.file) insertBlock('eafilevideo', v.file, range); else insertBlock('eavideo', embedUrl(v.link), range);
    }
    async function insertAudio() {
      const range = quill.getSelection(true);
      const p = dialog('Insert audio', `${uploadField('src', 'audio/*', 'audio', 'Upload an audio file (MP3, M4A, WAV…)')}<label>Title (optional)</label><input name="title" maxlength="120" placeholder="e.g. Interview with the project engineer">`);
      const form = dialog.last; wireUploads(form, opts);
      form._validate = fd => fd.get('src') ? null : 'Choose an audio file to upload.';
      const v = await p; if (!v) return;
      insertBlock('eaaudio', { src: v.src, title: v.title }, range);
    }

    // table tools appear when the cursor is inside a table
    const tbar = container.querySelector('.ea-table-bar'), tmod = quill.getModule('table');
    tbar.innerHTML = [['insertRowAbove', '+ Row above'], ['insertRowBelow', '+ Row below'], ['insertColumnLeft', '+ Column left'], ['insertColumnRight', '+ Column right'], ['deleteRow', '− Row'], ['deleteColumn', '− Column'], ['deleteTable', 'Delete table']]
      .map(([k, l]) => `<button type="button" class="btn sm ${k === 'deleteTable' ? 'no' : ''}" data-t="${k}">${l}</button>`).join('');
    tbar.addEventListener('mousedown', e => e.preventDefault());
    tbar.addEventListener('click', e => { const k = e.target.dataset.t; if (k) { tmod[k](); quill.focus(); } });
    quill.on('editor-change', () => {
      const r = quill.getSelection();
      tbar.hidden = !(r && quill.getFormat(r).table);
    });

    // load content
    if (html) quill.clipboard.dangerouslyPasteHTML(html, 'silent');
    quill.history.clear();

    // word count & reading time
    const status = container.querySelector('.ea-status');
    const count = () => {
      const words = (quill.getText().match(/\S+/g) || []).length;
      const media = host.querySelectorAll('.ea-fig,.ea-embed,.ea-vfile,.ea-afile').length;
      status.textContent = `${words.toLocaleString()} words · about ${Math.max(1, Math.round(words / 200))} min read${media ? ` · ${media} media item${media > 1 ? 's' : ''}` : ''}`;
    };
    quill.on('text-change', (d, o, src) => { count(); if (src === 'user') opts.onChange?.(); });
    count();

    return {
      quill,
      getHTML() {
        if (quill.getText().trim() === '' && !host.querySelector('.ea-fig,.ea-embed,.ea-vfile,.ea-afile,table,hr')) return '';
        return quill.getSemanticHTML().replace(/&nbsp;/g, ' ').replace(/ {2,}/g, m => ' ' + '&nbsp;'.repeat(m.length - 1));
      },
      getText: () => quill.getText(),
      setHTML(h) { quill.setContents([]); quill.clipboard.dangerouslyPasteHTML(h || '', 'silent'); count(); },
    };
  }

  window.EAEditor = { create, embedUrl };
})();
