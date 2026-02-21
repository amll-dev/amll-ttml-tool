import { useEffect } from 'react';
import type { TTMLLyric, LyricLine, LyricWord } from '../types/ttml';

function parseMixedText(text: string): { text: string; color: string | null }[] {
  const regex = /\{([^}]*?)#([0-9A-Fa-f]{6})([^}]*?)\}/g;
  const parts: { text: string; color: string | null }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while (true) {
    match = regex.exec(text);
    if (match === null) break;
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), color: null });
    }
    const innerText = match[1] + match[3];
    const color = '#' + match[2];
    parts.push({ text: innerText, color });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), color: null });
  }
  return parts;
}

function getMainText(line: LyricLine): string {
  return line.words.map((w: LyricWord) => w.word.split('#')[0]).join('');
}

function getCleanRoman(line: LyricLine): string {
  return line.romanLyric?.replace(/\{[^}]*#[0-9A-Fa-f]{6}[^}]*\}/g, (match) => {
    const inner = match.slice(1, -1);
    const hashIndex = inner.lastIndexOf('#');
    return hashIndex > 0 ? inner.slice(0, hashIndex) : inner;
  }) ?? '';
}

export const useLyricColorizer = (
  originalLyricLines: TTMLLyric,
  showTranslation: boolean,
  showRoman: boolean,
  enabled: boolean
) => {
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      const mainLineNodes = Array.from(document.querySelectorAll('[class*="lyricMainLine"]')) as HTMLElement[];
      const subLineNodes = Array.from(document.querySelectorAll('[class*="lyricSubLine"]')) as HTMLElement[];

      mainLineNodes.forEach(node => {
        node.style.removeProperty('color');
        node.style.removeProperty('text-shadow');
        Array.from(node.children).forEach(child => {
          (child as HTMLElement).style.removeProperty('color');
          (child as HTMLElement).style.removeProperty('text-shadow');
        });
      });
      subLineNodes.forEach(node => {
        node.style.removeProperty('color');
        node.style.removeProperty('text-shadow');
        if (node.dataset.splitApplied === 'true') {
          delete node.dataset.splitApplied;
        }
      });

      originalLyricLines.lyricLines.forEach((lineData, index) => {
        const mainText = getMainText(lineData);

        let mainNode = mainLineNodes.find(node =>
          node.textContent?.trim().replace(/\s+/g, ' ') === mainText.trim().replace(/\s+/g, ' ')
        );
        if (!mainNode && index < mainLineNodes.length) {
          mainNode = mainLineNodes[index];
        }

        if (mainNode) {
          const wordNodes = Array.from(mainNode.children) as HTMLElement[];

          if (lineData.words.length === 1) {
            const singleWord = lineData.words[0];
            const colorMatch = singleWord.word.match(/(#[0-9a-fA-F]{6})/);
            if (colorMatch) {
              const color = colorMatch[1];
              mainNode.style.setProperty('color', color, 'important');
              mainNode.style.setProperty('text-shadow', `0 0 15px ${color}`, 'important');
              wordNodes.forEach(child => {
                child.style.setProperty('color', color, 'important');
                child.style.setProperty('text-shadow', `0 0 15px ${color}`, 'important');
              });
            }
          } else {
            const unmatchedNodes = [...wordNodes];
            lineData.words.forEach((wordData) => {
              const cleanWord = wordData.word.split('#')[0];
              if (cleanWord.trim() === '') return;
              const nodeIndex = unmatchedNodes.findIndex(node =>
                node.textContent?.trim().replace(/\s+/g, ' ') === cleanWord.trim().replace(/\s+/g, ' ')
              );
              if (nodeIndex !== -1) {
                const targetNode = unmatchedNodes[nodeIndex];
                const colorMatch = wordData.word.match(/(#[0-9a-fA-F]{6})/);
                if (colorMatch) {
                  targetNode.style.setProperty('color', colorMatch[1], 'important');
                  targetNode.style.setProperty('text-shadow', `0 0 15px ${colorMatch[1]}`, 'important');
                }
                unmatchedNodes.splice(nodeIndex, 1);
              }
            });
          }
        }

        // 处理翻译行
        if (showTranslation && lineData.translatedLyric) {
          const transClean = parseMixedText(lineData.translatedLyric).map(p => p.text).join('');
          const subNode = subLineNodes.find(node =>
            node.textContent?.trim().replace(/\s+/g, ' ') === transClean.trim().replace(/\s+/g, ' ')
          );
          if (subNode && !subNode.dataset.splitApplied) {
            const parts = parseMixedText(lineData.translatedLyric);
            subNode.innerHTML = '';
            parts.forEach(part => {
              const span = document.createElement('span');
              span.textContent = part.text;
              if (part.color) {
                span.style.setProperty('color', part.color, 'important');
                span.style.setProperty('text-shadow', `0 0 10px ${part.color}`, 'important');
              }
              subNode.appendChild(span);
            });
            subNode.dataset.splitApplied = 'true';
          }
        }

        // 处理音译行
        if (showRoman && lineData.romanLyric) {
          const romanClean = getCleanRoman(lineData);
          // 查找匹配的音译行节点，注意可能与翻译行区分，这里简单通过文本匹配
          const subNode = subLineNodes.find(node =>
            node.textContent?.trim().replace(/\s+/g, ' ') === romanClean.trim().replace(/\s+/g, ' ')
          );
          if (subNode && !subNode.dataset.splitAppliedRoman) { // 使用不同的标记
            const parts = parseMixedText(lineData.romanLyric);
            subNode.innerHTML = '';
            parts.forEach(part => {
              const span = document.createElement('span');
              span.textContent = part.text;
              if (part.color) {
                span.style.setProperty('color', part.color, 'important');
                span.style.setProperty('text-shadow', `0 0 10px ${part.color}`, 'important');
              }
              subNode.appendChild(span);
            });
            subNode.dataset.splitAppliedRoman = 'true';
          }
        }
      });
    }, 500);

    return () => clearInterval(timer);
  }, [originalLyricLines, showTranslation, showRoman, enabled]);
};