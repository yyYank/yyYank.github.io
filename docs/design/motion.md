# Motion & Interaction Guidelines

## 1. Purpose

このサイトのMotionは、見た目を派手にするためのものではない。

目的は次の3つ。

1. 状態変化を理解しやすくする
2. 操作に対して即座に反応を返す
3. 触っていて気持ちいい感触を作る

MotionはUIを目立たせるためではなく、
**操作と結果のつながりを自然に感じさせるために使う。**

## 2. Core Principle

> **Visual is quiet. Interaction is rich. Motion is short.**

平常時の画面は静かに保つ。

ユーザーが操作した瞬間だけ、
小さく、短く、意味のある動きを返す。

Motionは常時存在する装飾ではなく、
**インタラクションの瞬間にだけ現れるフィードバック**として扱う。

## 3. Motion Values

### 3.1 Fast
UI操作の反応は基本的に100〜200ms台で完了させる。

### 3.2 Subtle
移動量、拡大率、opacity差を小さくする。

### 3.3 Physical
少しだけ物理感を持たせる。

- 押すと少し沈む
- Dragすると少し浮く
- 削除時に高さが縮む
- 追加時に少しだけ馴染む
- Reorder時に他要素が自然に避ける

### 3.4 Purposeful
すべてのMotionには理由が必要。
理由が説明できないアニメーションは入れない。

## 4. Motion Tokens

```css
:root {
  --motion-instant: 80ms;
  --motion-fast: 120ms;
  --motion-normal: 180ms;
  --motion-slow: 220ms;
  --motion-feedback: 300ms;

  --ease-standard: cubic-bezier(.2, .8, .2, 1);
  --ease-enter: cubic-bezier(.2, .8, .2, 1);
  --ease-exit: cubic-bezier(.4, 0, 1, 1);
}
```

| Token | Duration | Usage |
|---|---:|---|
| instant | 80ms | press, active |
| fast | 120ms | hover, focus, color |
| normal | 180ms | reveal, item movement |
| slow | 220ms | remove, collapse |
| feedback | <=300ms | success feedback |

## 5. Transition Rules

基本的には以下だけを使う。

```text
opacity
transform
background-color
border-color
color
height / max-height
```

避けるもの:

```text
transition: all
長時間のwidth animation
layout全体を揺らすanimation
box-shadowの大きな変化
filterの多用
```

## 6. Default Transition

```css
.interactive {
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}
```

## 7. Hover

Hoverは「操作可能であること」を静かに伝える。

```css
.item:hover {
  background: rgb(var(--surface-2));
}

.button:hover {
  transform: translateY(-1px);
}
```

避ける:

- 1.05倍以上の拡大
- 大きなShadow
- 激しい色変化
- 全体移動
- 長いTransition

## 8. Press / Active

```css
.button:active {
  transform: scale(.96);
}

.item:active {
  transform: scale(.995);
}
```

Pressは80〜120msを基本とする。

## 9. Focus

FocusはHoverより明確にする。

```css
.input:focus {
  border-color: rgb(var(--accent));
  background: rgb(var(--surface-2));
}
```

派手なGlowは使わない。

## 10. Add / Insert

新しい要素は「飛び込んでくる」のではなく、
**自然にその場へ馴染む**ようにする。

```css
@keyframes item-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.item-enter {
  animation:
    item-enter
    var(--motion-normal)
    var(--ease-enter);
}
```

移動量は4〜8px程度まで。

## 11. Complete

推奨フロー:

```text
1. Complete state
2. 色 / check変化
3. 80〜120ms程度の短い間
4. opacity低下
5. height縮小
6. remove
```

「消えた」ではなく、
**「片付いた」**と感じられることを重視する。

## 12. Remove

```css
.item-removing {
  opacity: 0;
  transform: translateX(6px);
  max-height: 0;
}
```

Duration:

```text
180〜220ms
```

大きく横へ飛ばさない。

## 13. Reorder

Drag開始時:

```text
scale: 1.01〜1.02
small elevation
slightly stronger surface
```

Drag中:

- 他Itemが滑らかに避ける
- Placeholder位置が理解できる
- pointer追従を遅らせない

Drop時:

- 位置へ自然に吸着
- Bounceはほぼ不要
- 120〜180ms程度

## 14. Copy Feedback

```text
Copy
↓
Copied ✓
↓
Copy
```

表示時間は1000〜1600ms程度。
アニメーション自体は短くする。

## 15. Generate / Regenerate

結果のみ更新する。

推奨:

```text
old result
↓
brief opacity change
↓
new result
```

避ける:

- slot machine animation
- 長時間のランダム文字変化
- 大きなflash
- 長いloading演出

## 16. Result Reveal

```css
@keyframes result-enter {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-enter {
  animation:
    result-enter
    var(--motion-normal)
    var(--ease-enter);
}
```

常に結果が存在するツールでは毎回Revealしない。

## 17. Toggle

Duration:

```text
120〜180ms
```

Transition対象:

```text
background
thumb transform
border
```

Elastic / Bounceは基本使わない。

## 18. Expand / Collapse

推奨:

```text
opacity
height
small translateY
```

Duration:

```text
180〜220ms
```

複数箇所が同時に大きく動く設計は避ける。

## 19. Popover / Menu

Enter:

```text
opacity 0 → 1
translateY 2〜4px → 0
```

Duration:

```text
120〜180ms
```

ExitはEnterより少し速くてもよい。

## 20. Dialog

推奨:

```text
Backdrop fade
Dialog opacity
Scale .98 → 1
```

Duration:

```text
180〜220ms
```

避ける:

- 大きなzoom
- screen edgeからの長いslide
- spring bounce

## 21. Navigation

ツール間移動ではページ全体に派手なTransitionを付けない。

必要なら:

```text
content opacity
small translateY
```

程度にする。

## 22. Loading

可能な限りLoadingを見せない。

必要な場合:

- Skeleton
- subtle opacity pulse
- inline spinner

避ける:

- 全画面Blocking spinner
- 長いProgress animation
- 意味のないLoading演出

## 23. Success

例:

```text
Copied
Saved
Done
Moved to Next
```

可能なら操作対象の近くで返す。

## 24. Error

ErrorはShakeさせない。

推奨:

- border color
- short error text
- subtle background

## 25. Empty State Motion

```text
last item disappears
↓
small pause
↓
quiet empty state fades in
```

Confettiなどは基本使わない。

## 26. Continuous Animation

常時動くAnimationは原則禁止。

避ける:

- floating decoration
- infinite gradient
- looping icons
- animated background
- blinking accent
- endless pulse

ユーザーが操作していないとき、
画面は静止していることを基本とする。

## 27. Microinteraction Budget

1つの操作にMotionを重ねすぎない。

推奨は2〜3要素まで。

## 28. Motion Hierarchy

### Primary interaction

最も丁寧に作る。

- Add
- Complete
- Generate
- Copy
- Drag
- Convert

### Secondary interaction

最小限。

- Menu
- Settings
- Section toggle

### Tertiary interaction

原則Motion不要。

- Metadata
- Static labels
- Explanatory text

## 29. Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Motionを減らしても、
状態変化自体は色・文字・位置などで理解できるようにする。

## 30. Tailwind Tokens

```js
extend: {
  transitionDuration: {
    instant: "80ms",
    fast: "120ms",
    normal: "180ms",
    slow: "220ms",
    feedback: "300ms",
  },

  transitionTimingFunction: {
    ui: "cubic-bezier(.2,.8,.2,1)",
    exit: "cubic-bezier(.4,0,1,1)",
  },
}
```

## 31. Tailwind Examples

### Button

```tsx
<button
  className="
    transition
    duration-fast
    ease-ui
    hover:-translate-y-px
    active:scale-95
  "
>
  Generate
</button>
```

### Item

```tsx
<div
  className="
    transition
    duration-normal
    ease-ui
    hover:bg-surface-2
  "
>
  ...
</div>
```

### Focus

```tsx
<input
  className="
    border border-border
    transition-colors
    duration-fast
    focus:border-accent
  "
/>
```

## 32. Framer Motion

複雑なLayout Animationが必要な場合のみ使用する。

使用候補:

- reorder
- presence
- shared layout
- complex collapse

単純なhoverやbutton pressはCSS Transitionで実装する。

## 33. Suggested Framer Motion Defaults

```tsx
const transition = {
  duration: 0.18,
  ease: [0.2, 0.8, 0.2, 1],
};
```

Enter:

```tsx
initial={{ opacity: 0, y: 4 }}
animate={{ opacity: 1, y: 0 }}
```

Exit:

```tsx
exit={{ opacity: 0, y: 4 }}
```

Press:

```tsx
whileTap={{ scale: 0.97 }}
```

## 34. Tool-specific Motion

### TODO / Transient

- Add
- Complete
- Reorder
- Move
- Undo

### Password

- Generate
- Regenerate
- Reveal
- Copy

### Converter

- Instant result update
- Swap
- Copy

### Defrag

- Throw
- Reposition
- Group
- Perspective change

個性は中心Interactionから作る。
ページ全体の装飾Animationで個性を作らない。

## 35. Do

- 短くする
- 小さく動かす
- 操作直後に反応する
- 位置関係を理解させる
- 状態変化を補助する
- 同じDurationを再利用する
- Motion tokenを使う
- Reduced Motionを考慮する

## 36. Avoid

- `transition: all`
- 300msを超える通常UI animation
- bounceの多用
- large scale
- large translate
- infinite animation
- gradient animation
- decorative parallax
- excessive spring
- hover-only information
- animation中に操作をBlockingする
- loadingを演出として長引かせる

## 37. Review Checklist

新しいMotionを追加するときは、以下を確認する。

### 1. 何を伝えるMotionか？
説明できなければ削除する。

### 2. 120〜220msで足りないか？
長くする前に短いDurationで試す。

### 3. 移動量を半分にできないか？
大きな動きより小さな動きを優先する。

### 4. CSSだけで実装できないか？
依存を増やさない。

### 5. Motionなしでも意味が分かるか？
Animationは補助であり、情報そのものにしない。

### 6. 毎日100回見ても邪魔ではないか？
初見の面白さより、繰り返し利用での快適さを優先する。

## 38. Final Principle

> **驚かせるためではなく、触ったことを気持ちよく理解させるためにある。**

画面は静かでよい。

ユーザーが触った瞬間だけ、
その操作にふさわしい反応を短く返す。

それをサイト全体で積み重ねることで、

**シンプルなのに触っていて飽きないUI**

を作る。
