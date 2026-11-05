// 첫 그리기 전에 테마를 정한다(깜빡임 방지). 저장값이 없거나 읽을 수 없으면 OS 설정을 따른다.
(function () {
	var root = document.documentElement;
	root.classList.add("js");
	var saved = null;
	try { saved = window.localStorage.getItem("theme"); } catch (e) { saved = null; }
	var theme = saved === "light" || saved === "dark"
		? saved
		: (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	root.setAttribute("data-theme", theme);

	// 첫 방문 오프닝: 홈에 처음 들어올 때 세션당 한 번. 움직임 줄이기 설정이면 하지 않는다.
	// 막은 CSS 애니메이션만으로 2초 안에 스스로 사라진다(스크립트가 실패해도 화면을 가리지 않음).
	try {
		var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		var home = window.location.pathname === "/" || window.location.pathname === "";
		if (home && !reduce && !window.sessionStorage.getItem("intro-seen")) {
			window.sessionStorage.setItem("intro-seen", "1");
			root.classList.add("intro-on");
		}
	} catch (e) { /* 저장소를 못 쓰면 오프닝 없이 바로 보여 준다 */ }
})();
