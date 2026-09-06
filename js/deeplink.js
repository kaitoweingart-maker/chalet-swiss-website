/*
 * Deep-Link-Parser fuer Google Free Booking Links (Kontrakt K1 / K1b).
 * Reine Funktion: liest nur den Query-String, fasst kein DOM an, kein Netz,
 * kein Storage. Laeuft im Browser als window.amDeepLink und unter node --test
 * ueber module.exports. utm_* und die Google-Parameter sind Kampagnen-
 * bezeichner, keine Personendaten; Gaestedaten sieht diese Datei nie.
 */
(function () {
  'use strict';

  var VERSION = '1';
  var RE_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  var RE_INT = /^\d+$/;
  var RE_UTM = /^[A-Za-z0-9._-]{1,64}$/;
  var RE_UCUR = /^[A-Z]{3}$/;
  var RE_GTOTAL = /^\d+(\.\d{1,2})?$/;
  var MAX_NIGHTS = 30;
  var MAX_LEAD_DAYS = 365;
  var DAY_MS = 86400000;
  var FALLBACK_LANG = 'en';
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
  function decode(s) {
    try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; }
  }

  // Eigenes Parsen statt URLSearchParams: gleiches Ergebnis in Browser und
  // Node, und bei einem doppelten Parameter gewinnt der erste Wert.
  function getParams(search) {
    var q = (search === null || search === undefined) ? '' : search.toString();
    var hash = q.indexOf('#');
    if (hash !== -1) q = q.slice(0, hash);
    if (q.charAt(0) === '?') q = q.slice(1);
    var out = {};
    var parts = q ? q.split('&') : [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var eq = parts[i].indexOf('=');
      var k = decode(eq === -1 ? parts[i] : parts[i].slice(0, eq));
      if (!has(out, k)) out[k] = decode(eq === -1 ? '' : parts[i].slice(eq + 1));
    }
    return out;
  }
  function str(params, key) {
    return has(params, key) ? params[key].toString().trim() : null;
  }
  function code(raw) {
    return raw ? raw.toString().trim().toUpperCase() || null : null;
  }
  function readInt(raw, fallback) {
    return (raw !== null && RE_INT.test(raw)) ? parseInt(raw, 10) : fallback;
  }

  // 'YYYY-M-D' mit echtem Kalendertag -> { iso: 'YYYY-MM-DD', time }, sonst null.
  function parseDate(raw) {
    var m = raw ? RE_DATE.exec(raw) : null;
    if (!m) return null;
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return { iso: y + '-' + pad2(mo) + '-' + pad2(d), time: dt.getTime() };
  }
  // Tagesdifferenz, nicht Millisekunden: die Sommerzeit macht einzelne Tage 23
  // oder 25 Stunden lang, eine reine Division verschoebe die Grenzen um einen Tag.
  function daysBetween(fromTime, toTime) { return Math.round((toTime - fromTime) / DAY_MS); }

  function resolveProperty(raw, cfg) {
    var want = code(raw);
    if (!want) return cfg.defaultProperty || null;
    for (var k in cfg.properties) {
      if (has(cfg.properties, k) && k.toUpperCase() === want) return k;
    }
    return null;
  }

  // Erste zwei Zeichen, kleingeschrieben; vorhanden aber unbekannt -> en.
  function resolveLang(raw, cfg) {
    if (raw === null) return null;
    var v = raw.toLowerCase().slice(0, 2);
    if (!v) return null;
    var langs = cfg.langs || [];
    for (var i = 0; i < langs.length; i++) {
      if (langs[i] === v) return v;
    }
    return FALLBACK_LANG;
  }

  function buildCampaign(params) {
    var out = null;
    for (var i = 0; i < UTM_KEYS.length; i++) {
      var v = str(params, UTM_KEYS[i]);
      if (v === null || !RE_UTM.test(v)) continue;
      if (!out) out = {};
      out[UTM_KEYS[i]] = v;
    }
    return out;
  }

  // Reihenfolge ist bindend (K1): der Pruefklick schlaegt alles, danach
  // entscheidet utm_medium zwischen Free Booking Link und bezahltem Klick.
  function deriveSource(params, campaign) {
    if (str(params, 'gverify') === 'true') return 'google_verify';
    if (!campaign || campaign.utm_source !== 'google') return null;
    if (!campaign.utm_campaign || campaign.utm_campaign.indexOf('hotel-') !== 0) return null;
    if (campaign.utm_medium === 'organic') return 'google_fbl';
    if (campaign.utm_medium === 'cpc') return 'google_hotel_ads';
    return null;
  }

  function buildGoogle(params) {
    var ucur = str(params, 'ucur');
    var gtotal = str(params, 'gtotal');
    if (ucur === null || !RE_UCUR.test(ucur)) ucur = null;
    if (gtotal === null || !RE_GTOTAL.test(gtotal)) gtotal = null;
    return (ucur === null && gtotal === null) ? null : { ucur: ucur, gtotal: gtotal };
  }

  function buildSearch(params, cfg) {
    var property = resolveProperty(str(params, 'property'), cfg);
    var arrival = parseDate(str(params, 'arrival'));
    var departure = parseDate(str(params, 'departure'));
    if (!property || !arrival || !departure) return null;
    var lead = daysBetween(new Date(cfg.today.getFullYear(), cfg.today.getMonth(), cfg.today.getDate()).getTime(), arrival.time);
    var nights = daysBetween(arrival.time, departure.time);
    if (lead < 0 || lead > MAX_LEAD_DAYS || nights < 1 || nights > MAX_NIGHTS) return null;
    var max = cfg.properties[property] || 1;
    var adults = clamp(readInt(str(params, 'adults'), 2), 1, max);
    return {
      property: property,
      arrival: arrival.iso,
      departure: departure.iso,
      adults: adults,
      children: clamp(readInt(str(params, 'children'), 0), 0, max - adults),
      lang: resolveLang(str(params, 'lang'), cfg)
    };
  }

  // parse(search, cfg) -> { search, preselect, source, campaign, google }.
  // cfg = { today: Date, properties: { <code>: <MAX> }, langs: [], defaultProperty }.
  // source, campaign und google kommen auch dann, wenn search null ist.
  function parse(search, cfg) {
    var c = cfg || {};
    var conf = {
      today: c.today || new Date(),
      properties: c.properties || {},
      langs: c.langs || [],
      defaultProperty: c.defaultProperty || null
    };
    var params = getParams(search);
    var room = code(str(params, 'room'));
    var rate = code(str(params, 'rate'));
    var campaign = buildCampaign(params);
    return {
      search: buildSearch(params, conf),
      preselect: (room || rate) ? { room: room, rate: rate } : null,
      source: deriveSource(params, campaign),
      campaign: campaign,
      google: buildGoogle(params)
    };
  }

  var api = { parse: parse, VERSION: VERSION };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.amDeepLink = api;
    try {
      document.dispatchEvent(new CustomEvent('am:deeplink-ready'));
    } catch (e) { /* alte Browser: booking.js prueft window.amDeepLink direkt */ }
  }
})();
