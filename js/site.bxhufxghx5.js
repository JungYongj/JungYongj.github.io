// 공개 페이지 공통 동작: 테마 토글 · 모바일 메뉴(포커스 가두기, Esc) · 등장 효과 · 헤더 그림자
// 정적 SSR + Enhanced Navigation 이라 DOM이 바뀔 수 있다 → 클릭은 위임으로 받고, 페이지 갱신 때 다시 맞춘다.
(function () {
	"use strict";

	var root = document.documentElement;

	// ---------- 테마 ----------
	function currentTheme() {
		return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
	}

	function storedTheme() {
		try { return window.localStorage.getItem("theme"); } catch (e) { return null; }
	}

	function syncThemeButton() {
		var dark = currentTheme() === "dark";
		document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
			btn.setAttribute("aria-label", dark ? "밝은 테마로 바꾸기" : "어두운 테마로 바꾸기");
			var label = btn.querySelector("[data-theme-label]");
			if (label) { label.textContent = dark ? "라이트" : "다크"; }
		});
	}

	function applyTheme(theme, save) {
		root.setAttribute("data-theme", theme);
		if (save) {
			try { window.localStorage.setItem("theme", theme); } catch (e) { /* 저장 못 해도 화면은 바뀐다 */ }
		}
		syncThemeButton();
	}

	// ---------- 모바일 메뉴 ----------
	function menuParts() {
		return {
			nav: document.querySelector("[data-nav]"),
			btn: document.querySelector("[data-menu-toggle]")
		};
	}

	function isMenuOpen() {
		var p = menuParts();
		return !!p.nav && p.nav.getAttribute("data-open") === "true";
	}

	function setMenu(open, restoreFocus) {
		var p = menuParts();
		if (!p.nav || !p.btn) { return; }
		p.nav.setAttribute("data-open", open ? "true" : "false");
		p.btn.setAttribute("aria-expanded", open ? "true" : "false");
		p.btn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
		var scrim = document.querySelector("[data-menu-scrim]");
		if (scrim) { scrim.hidden = !open; }
		if (open) {
			var first = p.nav.querySelector("a");
			if (first) { first.focus(); }
		} else if (restoreFocus) {
			p.btn.focus();
		}
	}

	// 상세 목차: <base href> 때문에 "#id"가 다른 페이지로 해석되지 않도록, 화면 전환 처리보다 먼저(window 캡처) 잡는다
	window.addEventListener("click", function (e) {
		var t = e.target instanceof Element ? e.target : null;
		var tocLink = t && t.closest("[data-toc-link]");
		if (!tocLink || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) { return; }
		var target = document.getElementById(tocLink.getAttribute("data-toc-link"));
		if (!target) { return; }
		e.preventDefault();
		e.stopPropagation();
		var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
		if (!target.hasAttribute("tabindex")) { target.setAttribute("tabindex", "-1"); }
		target.focus({ preventScroll: true });
		history.replaceState(history.state, "", location.pathname + location.search + "#" + target.id);
	}, true);

	document.addEventListener("click", function (e) {
		var t = e.target instanceof Element ? e.target : null;
		if (!t) { return; }
		if (t.closest("[data-theme-toggle]")) {
			applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
			return;
		}
		if (t.closest("[data-menu-toggle]")) {
			setMenu(!isMenuOpen(), false);
			return;
		}
		var frame = t.closest("[data-gal-open]");
		if (frame && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && canLightbox()) {
			e.preventDefault();
			openLightbox(frame.closest("[data-gallery]"), parseInt(frame.getAttribute("data-gal-open"), 10), frame);
			return;
		}
		var galBtn = t.closest("[data-gal-prev], [data-gal-next], [data-gal-go]");
		if (galBtn) {
			var gal = galBtn.closest("[data-gallery]");
			if (gal && gal._gal) {
				var cur = gal._gal.index();
				if (galBtn.hasAttribute("data-gal-go")) { gal._gal.go(parseInt(galBtn.getAttribute("data-gal-go"), 10)); }
				else { gal._gal.go(cur + (galBtn.hasAttribute("data-gal-next") ? 1 : -1)); }
			}
			return;
		}
		var copyBtn = t.closest("[data-copy]");
		if (copyBtn) {
			copyText(copyBtn);
			return;
		}
		if (isMenuOpen() && (t.closest("[data-nav] a") || !t.closest("[data-nav]"))) {
			setMenu(false, false);
		}
	});

	document.addEventListener("keydown", function (e) {
		if (!isMenuOpen()) { return; }
		if (e.key === "Escape") {
			setMenu(false, true);
			return;
		}
		if (e.key === "Tab") {
			var p = menuParts();
			var items = [p.btn].concat(Array.prototype.slice.call(p.nav.querySelectorAll("a")));
			var first = items[0];
			var last = items[items.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	});

	var desktop = window.matchMedia("(min-width: 768px)");
	function onViewport() { if (desktop.matches && isMenuOpen()) { setMenu(false, false); } }
	if (desktop.addEventListener) { desktop.addEventListener("change", onViewport); }

	// ---------- 메일 주소 복사 ----------
	function copyText(btn) {
		var holder = btn.closest(".contact-mail");
		var source = holder ? holder.querySelector("[data-copy-source]") : null;
		var label = btn.querySelector("[data-copy-label]");
		if (!source) { return; }
		var text = source.textContent.trim();
		function done(ok) {
			if (label) { label.textContent = ok ? "복사됨" : "직접 복사 부탁드립니다"; }
			btn.classList.toggle("is-done", ok);
			window.setTimeout(function () {
				if (label) { label.textContent = "복사"; }
				btn.classList.remove("is-done");
			}, 2000);
		}
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
		} else {
			// 보안 연결이 아니면 글자를 선택해 두어 사용자가 바로 복사할 수 있게 한다.
			var range = document.createRange();
			range.selectNodeContents(source);
			var sel = window.getSelection();
			if (sel) { sel.removeAllRanges(); sel.addRange(range); }
			done(false);
		}
	}

	// ---------- 프로젝트 화면 갤러리 ----------
	// 넘기기 자체는 CSS 스크롤 스냅이 한다. 여기서는 번호·버튼·썸네일·키보드만 맞춘다.
	function setupGalleries() {
		document.querySelectorAll("[data-gallery]").forEach(function (gal) {
			if (gal._gal) { return; }
			var track = gal.querySelector("[data-gal-track]");
			var slides = gal.querySelectorAll("[data-gal-slide]");
			if (!track || slides.length === 0) { return; }
			var bar = gal.querySelector("[data-gal-bar]");
			var current = gal.querySelector("[data-gal-current]");
			var prev = gal.querySelector("[data-gal-prev]");
			var next = gal.querySelector("[data-gal-next]");
			var thumbs = gal.querySelectorAll("[data-gal-go]");
			var thumbList = gal.querySelector(".gal-thumbs");
			var shown = -1;

			function index() {
				var step = slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth;
				return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / (step || 1))));
			}
			function go(i) {
				i = Math.max(0, Math.min(slides.length - 1, i));
				track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft });
			}
			function sync() {
				var i = index();
				if (i === shown) { return; }
				shown = i;
				if (current) { current.textContent = String(i + 1); }
				if (prev) { prev.disabled = i === 0; }
				if (next) { next.disabled = i === slides.length - 1; }
				thumbs.forEach(function (b, k) {
					var on = k === i;
					b.classList.toggle("is-active", on);
					if (on) { b.setAttribute("aria-current", "true"); } else { b.removeAttribute("aria-current"); }
					if (on && thumbList) {
						// 썸네일 줄만 옆으로 맞춘다 (페이지 세로 스크롤은 건드리지 않음)
						var li = b.parentElement;
						var left = li.offsetLeft - thumbList.offsetLeft;
						if (left < thumbList.scrollLeft || left + li.offsetWidth > thumbList.scrollLeft + thumbList.clientWidth) {
							thumbList.scrollLeft = left - (thumbList.clientWidth - li.offsetWidth) / 2;
						}
					}
				});
			}
			var ticking = false;
			track.addEventListener("scroll", function () {
				if (ticking) { return; }
				ticking = true;
				window.requestAnimationFrame(function () { ticking = false; sync(); });
			}, { passive: true });
			track.addEventListener("keydown", function (e) {
				if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
					e.preventDefault();
					go(index() + (e.key === "ArrowRight" ? 1 : -1));
				} else if (e.key === "Home" || e.key === "End") {
					e.preventDefault();
					go(e.key === "Home" ? 0 : slides.length - 1);
				}
			});
			gal._gal = { go: go, index: index };
			if (bar) { bar.hidden = false; }
			sync();
		});
	}

	// ---------- 사진 크게 보기 ----------
	// 자바스크립트가 없거나 dialog를 못 쓰는 브라우저는 링크대로 새 탭에서 원본이 열린다.
	function canLightbox() { return typeof HTMLDialogElement === "function" && "showModal" in HTMLDialogElement.prototype; }
	var lb = null;
	var ICON_PREV = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
	var ICON_NEXT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
	var ICON_X = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
	function buildLightbox() {
		var d = document.createElement("dialog");
		d.className = "lightbox";
		d.setAttribute("aria-label", "작업 화면 크게 보기");
		d.innerHTML =
			'<div class="lb-top"><p class="lb-count" aria-live="polite"><strong data-lb-current>1</strong> / <span data-lb-total>1</span></p>' +
			'<div class="lb-tools"><a class="lb-orig" data-lb-orig target="_blank" rel="noopener">원본 크기로 열기</a>' +
			'<button type="button" class="lb-btn" data-lb-close aria-label="닫기">' + ICON_X + '</button></div></div>' +
			'<div class="lb-stage" data-lb-stage><img data-lb-img alt="" />' +
			'<button type="button" class="lb-btn lb-prev" data-lb-prev aria-label="이전 화면">' + ICON_PREV + '</button>' +
			'<button type="button" class="lb-btn lb-next" data-lb-next aria-label="다음 화면">' + ICON_NEXT + '</button></div>' +
			'<p class="lb-cap" data-lb-cap></p>';
		document.body.appendChild(d);
		var state = { dialog: d, shots: [], i: 0, gal: null, opener: null };
		var img = d.querySelector("[data-lb-img]");
		function show(i) {
			var n = state.shots.length;
			state.i = Math.max(0, Math.min(n - 1, i));
			var shot = state.shots[state.i];
			img.src = shot.src;
			img.alt = shot.caption;
			d.querySelector("[data-lb-current]").textContent = String(state.i + 1);
			d.querySelector("[data-lb-total]").textContent = String(n);
			d.querySelector("[data-lb-orig]").href = shot.src;
			var cap = d.querySelector("[data-lb-cap]");
			cap.textContent = "";
			var num = document.createElement("span");
			num.className = "gal-num";
			num.textContent = (state.i < 9 ? "0" : "") + (state.i + 1);
			cap.appendChild(num);
			cap.appendChild(document.createTextNode(" " + shot.caption));
			var single = n < 2;
			d.querySelector("[data-lb-prev]").hidden = single;
			d.querySelector("[data-lb-next]").hidden = single;
			d.querySelector("[data-lb-prev]").disabled = state.i === 0;
			d.querySelector("[data-lb-next]").disabled = state.i === n - 1;
			[state.i - 1, state.i + 1].forEach(function (k) {
				if (k >= 0 && k < n) { var pre = new Image(); pre.src = state.shots[k].src; }
			});
		}
		state.show = show;
		d.addEventListener("click", function (e) {
			var t = e.target instanceof Element ? e.target : null;
			if (!t) { return; }
			if (t.closest("[data-lb-close]") || t === d || t.hasAttribute("data-lb-stage")) { d.close(); return; }
			if (t.closest("[data-lb-prev]")) { show(state.i - 1); return; }
			if (t.closest("[data-lb-next]")) { show(state.i + 1); }
		});
		d.addEventListener("keydown", function (e) {
			if (e.key === "ArrowLeft") { e.preventDefault(); show(state.i - 1); }
			else if (e.key === "ArrowRight") { e.preventDefault(); show(state.i + 1); }
		});
		var startX = null;
		d.addEventListener("touchstart", function (e) { startX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
		d.addEventListener("touchend", function (e) {
			if (startX === null) { return; }
			var dx = e.changedTouches[0].clientX - startX;
			startX = null;
			if (Math.abs(dx) > 50) { show(state.i + (dx < 0 ? 1 : -1)); }
		}, { passive: true });
		d.addEventListener("close", function () {
			root.classList.remove("lb-open");
			// 갤러리도 마지막으로 본 화면에 맞춰 둔다
			if (state.gal && state.gal._gal) { state.gal._gal.go(state.i); }
			var back = state.gal && state.gal.querySelector('[data-gal-open="' + state.i + '"]');
			if (!back && state.opener && document.contains(state.opener)) { back = state.opener; }
			if (back) { back.focus({ preventScroll: true }); }
		});
		return state;
	}
	function openLightbox(gal, i, opener) {
		if (!gal) { return; }
		if (!lb || !document.body.contains(lb.dialog)) { lb = buildLightbox(); }
		lb.gal = gal;
		lb.opener = opener;
		lb.shots = Array.prototype.map.call(gal.querySelectorAll("[data-gal-open]"), function (a) {
			var im = a.querySelector("img");
			return { src: a.getAttribute("href"), caption: im ? im.getAttribute("alt") || "" : "" };
		});
		lb.show(i);
		root.classList.add("lb-open");
		lb.dialog.showModal();
		lb.dialog.querySelector("[data-lb-close]").focus();
	}

	// ---------- 상세 목차: 지금 읽는 곳 표시 ----------
	var tocLinks = [];
	function setupToc() {
		tocLinks = Array.prototype.slice.call(document.querySelectorAll("[data-toc-link]"));
		spyToc();
	}
	function spyToc() {
		if (tocLinks.length === 0) { return; }
		var line = (document.querySelector(".site-header") || { offsetHeight: 64 }).offsetHeight + 120;
		var active = tocLinks[0];
		tocLinks.forEach(function (a) {
			var sec = document.getElementById(a.getAttribute("data-toc-link"));
			if (sec && sec.getBoundingClientRect().top <= line) { active = a; }
		});
		// 맨 아래에 닿으면 마지막 항목
		if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) { active = tocLinks[tocLinks.length - 1]; }
		tocLinks.forEach(function (a) {
			if (a === active) { a.setAttribute("aria-current", "true"); } else { a.removeAttribute("aria-current"); }
		});
	}
	var spyTicking = false;
	window.addEventListener("scroll", function () {
		if (spyTicking || tocLinks.length === 0) { return; }
		spyTicking = true;
		window.requestAnimationFrame(function () { spyTicking = false; spyToc(); });
	}, { passive: true });

	// ---------- 헤더 경계선 ----------
	function onScroll() {
		var h = document.querySelector(".site-header");
		if (h) { h.classList.toggle("is-scrolled", window.scrollY > 4); }
	}
	window.addEventListener("scroll", onScroll, { passive: true });

	// ---------- 등장 효과 ----------
	var observer = null;
	function setupReveal() {
		var items = document.querySelectorAll(".reveal:not(.is-visible)");
		var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduce || !("IntersectionObserver" in window)) {
			items.forEach(function (el) { el.classList.add("is-visible"); });
			return;
		}
		if (!observer) {
			observer = new IntersectionObserver(function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						entry.target.classList.add("is-visible");
						observer.unobserve(entry.target);
					}
				});
			}, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
		}
		items.forEach(function (el) { observer.observe(el); });
	}

	// ---------- 첫 방문 오프닝: 건너뛰기 + 끝나면 정리 ----------
	// 막은 CSS만으로 사라지므로 여기서는 "빨리 넘기기"와 클래스 정리만 한다.
	if (root.classList.contains("intro-on")) {
		var finished = false;
		var finish = function (delay) {
			if (finished) { return; }
			finished = true;
			window.setTimeout(function () { root.classList.remove("intro-on", "intro-skip"); }, delay);
		};
		var skip = function () {
			if (finished) { return; }
			root.classList.add("intro-skip");
			finish(700);
		};
		["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (type) {
			window.addEventListener(type, skip, { once: true, passive: true });
		});
		window.setTimeout(function () { finish(0); }, 3750); // 막이 다 걷힌 뒤(약 3초) 정리
	}

	// ---------- 페이지마다 다시 맞추기 ----------
	function refresh() {
		// Enhanced Navigation이 <html> 속성을 되돌릴 수 있어 다시 적용한다.
		var saved = storedTheme();
		if (saved === "light" || saved === "dark") { root.setAttribute("data-theme", saved); }
		root.classList.add("js");
		syncThemeButton();
		setMenu(false, false);
		onScroll();
		setupReveal();
		setupGalleries();
		setupToc();
	}

	refresh();
	if (window.Blazor && typeof window.Blazor.addEventListener === "function") {
		window.Blazor.addEventListener("enhancedload", refresh);
	}
})();
