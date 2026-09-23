# Site Design System & Product Principles

## 1. Purpose

このサイトは、TODO、ランダムパスワード生成、変換、整理、可視化など、
**小さな用途のためのツール群を、ひとつの気持ちよい体験として提供する場所**である。

個々のツールは単機能でもよい。
重要なのは、サイト全体として触ったときに、

- 軽い
- 迷わない
- 飽きない
- 気持ちよく反応する
- また使いたくなる

という共通した感触があること。

目指すのは「機能の寄せ集め」ではなく、
**同じ価値観・同じUI文法を持つ、小さな道具のコレクション**である。


## 2. North Star

> **Simple to look at. Satisfying to use.**

見た目は静かに、操作は気持ちよく。

情報量が増えても複雑に見せず、
機能が増えてもUIオブジェクトを増やしすぎない。

楽しさは装飾ではなく、
**操作したときの反応、状態変化、リズム**から生み出す。


## 3. Product Values

### 3.1 Utility without utility-app dullness

便利であることは前提だが、
「ただ使えるだけ」の無機質なツールにはしない。

単純な機能でも、

- 入力した瞬間
- 結果が出る瞬間
- コピーする瞬間
- 完了する瞬間
- 並べ替える瞬間
- 消える瞬間

に小さな満足感を持たせる。


### 3.2 Calm

平常時の画面は静かであること。

色、線、カード、影、装飾を増やして情報を整理しない。

優先順位は主に、

- Typography
- Spacing
- Position
- Contrast
- Interaction state

で表現する。


### 3.3 Immediate

ユーザーの入力には即座に反応する。

可能な限り、

> Input → Result

の距離を短くする。

「設定してから実行」
「モーダルを開いてから入力」
「結果ページへ遷移」

のような不要なステップを避ける。


### 3.4 Tactile

UIは視覚的なオブジェクトであると同時に、
**触れるもの**として設計する。

静止状態の美しさより、

- hover
- focus
- press
- drag
- complete
- reveal
- copy
- undo
- reorder

の品質を重視する。


### 3.5 Familiar

毎日の道具として、学習コストを低く保つ。

基本操作は一般的なWeb UIの慣習に従う。

新規性は奇抜な構造ではなく、
**既知のUIをどれだけ気持ちよく磨けるか**から生み出す。


### 3.6 Personality without noise

サイトには人格があってよいが、
装飾が機能より前に出てはいけない。

各ツールは少し違う体験を持ってよい。

ただし、

- 色体系
- Typography
- Motion
- Shape
- Feedback
- Spacing

はサイト全体で共通させる。


## 4. Core Design Direction

### Visual is quiet.
### Interaction is rich.
### Motion is short.
### Objects are few.

これをサイト全体の基本原則とする。


## 5. Tool Philosophy

各ツールは「ページ」ではなく、
**ひとつの作業面**として考える。

ユーザーは説明を読むためではなく、
すぐ使うために訪れる。

そのため基本構造は、

1. 何のツールか分かる
2. すぐ入力できる
3. 即座に結果が返る
4. 次の操作が自然に分かる

という流れにする。


## 6. UI Object Model

UIオブジェクトの種類を意図的に限定する。

基本オブジェクトは以下とする。

1. Page
2. Section
3. Item
4. Input
5. Action
6. Result
7. Status
8. Popover
9. Dialog
10. Navigation

新しい機能を追加するたびに
新しい見た目を作らない。


## 7. UI Object Rule

> **New feature does not automatically mean new component.**

新しいツールを追加するときは、
まず既存オブジェクトの組み合わせで表現する。

例えば、

- TODO
- Password
- Text converter
- Timer
- Generator
- Formatter

があっても、
それぞれ別のデザインシステムを持たせない。

入力は `Input`、
結果は `Result`、
操作は `Action`、
状態は `Status`
という共通文法で表現する。


## 8. Page Structure

各ツールページは基本的に以下の順序を持つ。

```text
Page
├─ Header / Tool identity
├─ Primary workspace
│  ├─ Input
│  ├─ Main action
│  └─ Result
├─ Secondary controls
├─ History / related state
└─ Supporting information
```

ただし、機能によって不要なものは表示しない。


## 9. Primary Workspace

ページで最も重要なのは
「ツールを使う場所」である。

タイトル、説明文、ナビゲーションよりも、
**操作面を視覚的な主役**にする。

原則として、

- Primary actionは1つ
- Primary inputは最初に目に入る
- Resultは入力との関係が分かる位置に置く
- 補助操作は一段弱くする

ことを守る。


## 10. Information Hierarchy

### Primary

今触るもの。

- Main input
- Main result
- Main action
- Current item

### Secondary

必要なときに使うもの。

- Options
- History
- Templates
- Previous results
- Secondary actions

### Tertiary

理解を補助するもの。

- Metadata
- Counts
- Hints
- Short descriptions
- Keyboard shortcuts

すべてを同じ強さで表示しない。


## 11. Navigation

ツールが増えても、
ナビゲーションを管理画面化しない。

分類は必要最小限とする。

推奨:

- Tool list
- Search
- Recent
- Favorites
- Simple categories

避ける:

- 多段階サイドバー
- 複雑なフィルター
- 深いカテゴリ階層
- Dashboard化


## 12. Color Philosophy

色は機能カテゴリを分類するためではなく、
**空間の温度と操作状態を表現するために使う。**

ツールごとにテーマカラーを持たせすぎない。

基本はSemantic Tokenで統一する。


## 13. Light Theme

### Warm Paper + Muted Green

```css
:root {
  --bg: 246 244 238;

  --surface: 255 254 250;
  --surface-2: 240 238 231;

  --text: 37 39 32;
  --muted: 125 129 119;
  --faint: 164 167 159;

  --border: 227 224 214;
  --border-strong: 184 189 175;

  --accent: 89 107 85;
  --accent-strong: 72 91 69;
  --accent-soft: 230 236 226;

  --accent-foreground: 255 255 255;

  --success: 86 132 105;
  --danger: 174 98 92;
  --warning: 167 126 65;
}
```


## 14. Dark Theme

### Warm Charcoal + Muted Olive

```css
.dark {
  --bg: 27 28 25;

  --surface: 35 36 31;
  --surface-2: 42 44 38;

  --text: 236 236 229;
  --muted: 154 157 146;
  --faint: 116 119 110;

  --border: 53 55 47;
  --border-strong: 74 77 67;

  --accent: 156 173 143;
  --accent-strong: 175 192 161;
  --accent-soft: 45 52 42;

  --accent-foreground: 23 26 21;

  --success: 112 157 126;
  --danger: 213 132 124;
  --warning: 194 153 88;
}
```


## 15. Color Rules

### Accent

Accentは以下に限定して使う。

- Focus
- Selection
- Primary action
- Active state
- Completion
- Important feedback

装飾目的で大量に使用しない。


### Semantic colors

Success / Warning / Dangerは
状態を伝える必要がある場合だけ使用する。

機能ごとのブランドカラーとしては使わない。


### Surface

Surface階層は最大3段階を基本とする。

```text
Background
Surface
Interactive / Raised Surface
```

新しいカードを作るたびに
新しい背景色を追加しない。


## 16. Typography

Typographyはサイト全体で共通にする。

### Suggested scale

```text
12px  Metadata
14px  Secondary UI
15px  Default
18px  Small heading
24px  Section heading
30–34px Page heading
```

### Principles

- 大見出しを乱用しない
- Boldを増やしすぎない
- 補助情報は色を弱くする
- 情報階層は色よりサイズと余白で作る
- 説明文は短くする


## 17. Spacing

固定スケールを使用する。

```text
4
8
12
16
24
32
48
64
```

個別コンポーネントごとに
独自の余白を作らない。

情報量が多くなっても、
カードを増やすのではなく
**余白のリズムで整理する。**


## 18. Shape

Radiusは少数に限定する。

```text
6px   Small control
10px  Item / Button
12px  Input / Panel
16px  Large temporary surface
```

すべてを角丸カードにしない。

Radiusは
「触れるオブジェクト」を認識させるために使う。


## 19. Borders & Shadows

### Borders

境界線は構造理解に必要な場所だけに使う。

できるだけ、

> BorderよりSpacing

を優先する。


### Shadows

通常状態では基本的に使わない。

使用候補:

- Popover
- Dialog
- Floating element
- Dragging state

Shadowは階層を伝えるためだけに使用する。


## 20. Motion System

Motionは装飾ではなく
**状態変化の理解を助けるために使う。**

### Tokens

```text
instant   80ms
fast      120ms
normal    180ms
exit      180–220ms
success   <= 300ms
```

### Easing

```css
cubic-bezier(.2, .8, .2, 1)
```


## 21. Motion Principles

### Add

追加されたものは派手に登場させない。

少しだけ位置・opacityを変化させ、
自然に馴染ませる。


### Remove

突然消さない。

状態変化 → 少し縮む → 消える、
という短い流れにする。


### Copy

コピー成功は短いフィードバックだけで十分。

例:

```text
Copy
↓
Copied ✓
↓
Copy
```


### Result Update

結果の更新時に
画面全体を再レンダリングしたように見せない。

結果部分だけ静かに変化させる。


### Drag

ドラッグ中は、

- 少し浮く
- 移動先が分かる
- 他要素が自然に避ける

という最低限の物理感を持たせる。


## 22. Interaction Philosophy

> **Shapes are few. Behaviors are rich.**

UIオブジェクトそのものは少なくする。

その代わり、
同じオブジェクトに豊かな状態を持たせる。


### Example: Item

```text
default
hover
focus
selected
dragging
completed
disabled
removing
```

別コンポーネントを作るのではなく、
同じItemの状態として扱う。


## 23. Small Delight

サイトの楽しさは
小さなインタラクションの積み重ねで作る。

候補:

- checkboxの反応
- button press
- focus transition
- copy feedback
- drag & reorder
- result reveal
- undo
- clear
- completion
- empty state
- keyboard shortcuts

派手な演出を1つ作るより、
**毎回触る操作を丁寧にする。**


## 24. Inputs

Inputはフォーム部品ではなく
「作業面への入口」として扱う。

原則:

- labelは必要な場合のみ
- placeholderを説明文代わりにしすぎない
- focus時に存在感を少し上げる
- Enterで実行可能にする
- 不要なsubmitボタンを置かない
- 可能なら入力と同時に結果を出す


## 25. Buttons

Buttonの種類は限定する。

基本:

1. Primary
2. Secondary
3. Ghost
4. Destructive

これ以上増やさない。


### Primary

その画面で最も重要な操作。

Accentを使用してよい。


### Secondary

Surface + Border。


### Ghost

補助操作。

通常時は目立たせない。


### Destructive

Danger色は必要な場合のみ。


## 26. Results

Resultは「カードだから囲う」のではなく、
**入力との関係が理解しやすい形**で表示する。

例:

- Password → 大きな文字 + Copy
- Converter → input/outputを隣接
- Formatter → editor/result
- TODO → list item
- Timer → current state

結果形式は機能に合わせて変えてよい。

ただし、

- Typography
- Action
- Feedback
- Color
- Motion

は共通文法を使用する。


## 27. Empty States

空状態を「何もない問題」と考えない。

ツールによっては空であることが自然な状態である。

Empty stateは、

- 静か
- 短い
- 入力を促しすぎない
- 過剰なイラストを使わない

ことを基本とする。


## 28. Content

UIが理解できる場合、
説明文を書かない。

### Prefer

```text
Password length
16
```

### Avoid

```text
ここでは生成するパスワードの文字数を設定できます。
以下のスライダーを使用して長さを変更してください。
```

文章はユーザーの操作を止めない。


## 29. Tool Personality

全ツールを完全に同じ見た目にする必要はない。

それぞれの機能が最も自然に感じる
**中心インタラクション**は変えてよい。

例:

### TODO

- Add
- Complete
- Reorder
- Clear

### Password

- Generate
- Regenerate
- Copy
- Reveal

### Converter

- Type
- Instant transform
- Swap
- Copy

### Defrag

- Throw
- Arrange
- Switch perspective
- Clear

人格は中心インタラクションから作る。

色や装飾を大量に変えて人格を作らない。


## 30. Site Consistency

共通させるもの:

- Color tokens
- Typography
- Radius
- Spacing
- Motion duration
- Feedback language
- Button behavior
- Focus behavior
- Navigation
- Keyboard philosophy

変えてよいもの:

- Workspace layout
- Primary interaction
- Result presentation
- Tool-specific motion
- Empty state copy


## 31. Accessibility

楽しさより先に、
操作可能であることを守る。

必須:

- Keyboard accessible
- Visible focus
- Semantic HTML
- Sufficient contrast
- Reduced motion support
- Touch target確保
- Colorだけで状態を伝えない


## 32. Responsive Philosophy

モバイル版を
「デスクトップを狭くしたもの」にしない。

各ツールの中心操作が
最も触りやすい構造へ再配置する。

基本:

- Primary input first
- Main action reachable
- Secondary information collapsible
- Horizontal densityを下げる
- Toolbarを増やしすぎない


## 33. Things to Avoid

サイト全体で以下を避ける。

- SaaS dashboard化
- 機能ごとのテーマカラー
- カードの大量配置
- Badgeの乱用
- Glassmorphismの常用
- 強いShadow
- グラデーション主体の装飾
- 常時表示される長い説明
- 深いナビゲーション
- 大量の設定項目
- 新機能ごとの新UI
- 長いTransition
- 意味のないAnimation
- 「モダンっぽさ」のためだけの装飾


## 34. Decision Framework

新しいデザイン判断をするときは、
以下の順番で判断する。


### 1. すぐ使えるか？

説明を読まずに操作を開始できるか。


### 2. UIオブジェクトを増やしていないか？

既存の文法で表現できないか。


### 3. 視覚ノイズを増やしていないか？

色・Border・Cardを追加する前に
SpacingやTypographyで解決できないか。


### 4. Interactionで解決できないか？

静止状態に情報を詰め込むより、
hover / focus / revealで必要時だけ見せられないか。


### 5. 毎日見ても疲れないか？

初見のインパクトより
継続利用を優先できているか。


### 6. 操作したくなるか？

ただ分かりやすいだけでなく、
触ったときの反応が気持ちよいか。


## 35. Implementation Principle

React / Tailwind側では
Semantic Tokenを中心に使用する。

例:

```text
bg-bg
bg-surface
bg-surface-2

text-text
text-muted
text-faint

border-border
border-border-strong

bg-accent
text-accent
bg-accent-soft
```

コンポーネント内に
個別の色コードを書かない。

Light / Darkは同一コンポーネントを使い、
Tokenのみ差し替える。


## 36. Final Principle

このサイトの洗練度は、
装飾の多さではなく
**制約の強さ**から生まれる。

- 色を増やさない
- UIオブジェクトを増やさない
- Surfaceを増やさない
- Motionを長くしない
- 説明を書きすぎない

その代わり、

- Interactionを丁寧にする
- Feedbackを速くする
- Typographyを整える
- Spacingを揃える
- 状態変化を磨く

最終的に目指すのは、

> **たくさんの小さなツールがあるのに、ひとつの道具箱として静かで、触っていて楽しいサイト。**
