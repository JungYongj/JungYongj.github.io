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
			if (label) { label.textContent = ok ? "복사됨" : "직접 복사해 주세요"; }
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
	}

	refresh();
	if (window.Blazor && typeof window.Blazor.addEventListener === "function") {
		window.Blazor.addEventListener("enhancedload", refresh);
	}
})();
