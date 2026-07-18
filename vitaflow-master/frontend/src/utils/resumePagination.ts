export function createResumePaginationScript() {
  return `
    <script>
      (function () {
        function pageHeightPx() {
          var marker = document.createElement('div');
          marker.style.cssText = 'position:absolute;left:-9999px;top:0;height:297mm;width:1px;';
          document.body.appendChild(marker);
          var height = marker.getBoundingClientRect().height;
          marker.remove();
          return height || 1123;
        }

        function cssLengthToPx(value, mmPx, fallbackPx) {
          var raw = String(value || '').trim();
          if (!raw) return fallbackPx || 0;
          var number = parseFloat(raw);
          if (!isFinite(number)) return fallbackPx || 0;
          if (raw.indexOf('px') > -1) return number;
          if (raw.indexOf('mm') > -1) return number * mmPx;
          return number * mmPx;
        }

        function clampMargin(value, pageHeight) {
          if (!isFinite(value) || value < 0) return 0;
          return Math.min(value, pageHeight * 0.35);
        }

        function pageMetrics(page, pageHeight) {
          var view = page.ownerDocument.defaultView || window;
          var style = view.getComputedStyle(page);
          var mmPx = pageHeight / 297;
          var firstTop = cssLengthToPx(style.getPropertyValue('--page-margin-top'), mmPx, parseFloat(style.paddingTop));
          var firstBottom = cssLengthToPx(style.getPropertyValue('--page-margin-bottom'), mmPx, parseFloat(style.paddingBottom));
          firstTop = clampMargin(firstTop, pageHeight);
          firstBottom = clampMargin(firstBottom, pageHeight);
          var nextTop = clampMargin(cssLengthToPx(style.getPropertyValue('--page-margin-next-top'), mmPx, firstTop), pageHeight);
          var nextBottom = clampMargin(cssLengthToPx(style.getPropertyValue('--page-margin-next-bottom'), mmPx, firstBottom), pageHeight);
          var nextContentHeight = Math.max(pageHeight - nextTop - nextBottom, pageHeight * 0.35);
          return {
            pageHeight: pageHeight,
            firstContentEnd: pageHeight - firstBottom,
            contentHeight: nextContentHeight
          };
        }

        function distanceToContentBottom(top, metrics) {
          if (top < metrics.firstContentEnd) return metrics.firstContentEnd - top;
          var offset = top - metrics.firstContentEnd;
          var rest = metrics.contentHeight - (offset % metrics.contentHeight);
          return rest || metrics.contentHeight;
        }

        function settlePageBreaks() {
          var page = document.querySelector('.resume-page');
          if (!page) return;
          var pageHeight = pageHeightPx();
          var metrics = pageMetrics(page, pageHeight);
          var selector = [
            '.section-title',
            '.item-head',
            '.timeline-section-title',
            '.timeline-item-head',
            '.timeline-sub',
            '.timeline-tech',
            '.tag-row',
            '.rich-text-body p',
            '.rich-text-body li'
          ].join(',');
          var targets = Array.prototype.slice.call(document.querySelectorAll(selector));
          targets.forEach(function (el) { el.style.marginTop = ''; });
          targets.forEach(function (el) {
            var rect = el.getBoundingClientRect();
            if (!rect.height || rect.height > pageHeight * 0.65) return;
            var pageRect = page.getBoundingClientRect();
            var top = rect.top - pageRect.top;
            if (top < 0) return;
            var rest = distanceToContentBottom(top, metrics);
            var guardHeight = Math.min(rect.height, 72);
            if (rest > 0 && rest < guardHeight + 8) el.style.marginTop = (rest + 1) + 'px';
          });
        }

        window.__vitaflowSettleResumePages = settlePageBreaks;
        requestAnimationFrame(function () {
          settlePageBreaks();
          requestAnimationFrame(settlePageBreaks);
        });
      })();
    <\/script>
  `
}
