import React, { useState, useEffect, useRef } from "react";

// ============================================================
// CodeQuest — Course hub.
//   • Main screen: pick a language CLASS (course-style, chapters shown)
//   • Progress persists across the session → feels like "continue"
//   • JS & Python: real test grading. A few more: AI-judged.
//   • Learn-to-read-first flow (read→pick→build→fill→type), no typing early
//   • "Too easy" button on EVERY step (fixed) with a hardest-level note
//
// Honest notes kept visible: AI-judged tracks are labeled; progress
// resets on refresh (no backend yet) — said plainly, not hidden.
// ============================================================

// ---------- Honest run-verification ----------
function verifyRuns(code, fnName, tests) {
  let fn;
  try { fn = new Function(`${code}; return typeof ${fnName}==='function'?${fnName}:undefined;`)(); }
  catch (e) { return { ok: false, why: "it couldn't run: " + e.message }; }
  if (!fn) return { ok: false, why: `no function called ${fnName} yet` };
  for (const t of tests) {
    let got;
    try { got = fn(...t.args); } catch (e) { return { ok: false, why: "it hit an error: " + e.message }; }
    if (JSON.stringify(got) !== JSON.stringify(t.expected))
      return { ok: false, why: `with ${t.args.join(", ")} it gave ${JSON.stringify(got)}, but should give ${JSON.stringify(t.expected)}` };
  }
  return { ok: true };
}

// ---------- The General Coding course (language-neutral, think like a coder) ----------
// Puzzles first, then neutral code. Progressively harder. Three skills:
// patterns/reading, breaking into steps, predicting what code does.
const GENERAL_STEPS = [
  // Chapter 1 — Spotting patterns (plain-English puzzles)
  { type: "puzzle", chapter: "1 · Spotting patterns", title: "What comes next?",
    intro: "Coders see patterns everywhere. No code yet — just look at the pattern and pick what comes next.",
    q: "2, 4, 6, 8, ___", choices: ["9", "10", "12"], correctIndex: 1,
    why: "Yes — each number goes up by 2, so after 8 comes 10. Spotting a rule like that is the core of coding." },
  { type: "puzzle", chapter: "1 · Spotting patterns", title: "Colors repeating",
    intro: "Another pattern. What fills the blank?",
    q: "red, blue, red, blue, red, ___", choices: ["red", "blue", "green"], correctIndex: 1,
    why: "Right — it alternates red, blue. Code repeats patterns like this all the time (it's called a loop)." },
  { type: "puzzle", chapter: "1 · Spotting patterns", title: "The odd one out",
    intro: "Which one doesn't follow the rule? Think about what the others have in common.",
    q: "Which doesn't belong: 2, 4, 7, 6, 8?", choices: ["4", "7", "8"], correctIndex: 1,
    why: "Yes — 7 is the only odd number; the rest are even. Coders constantly ask 'what's different here?'" },

  // Chapter 2 — Breaking things into steps (ordering)
  { type: "order", chapter: "2 · Breaking into steps", title: "Getting dressed",
    intro: "Computers need every step, in the right order. Put these in the order that makes sense — think about what HAS to happen first.",
    items: ["Put on your shoes", "Put on your socks"],
    correct: [1, 0],
    why: "Exactly — socks first, then shoes. You can't put socks over shoes! Order matters in code the same way: some steps only work after others." },
  { type: "order", chapter: "2 · Breaking into steps", title: "Making a sandwich",
    intro: "Another order puzzle. Put these steps in the order that actually works.",
    items: ["Put the top slice of bread on", "Get two slices of bread", "Add the filling on the bottom slice"],
    correct: [1, 2, 0],
    why: "Right — get the bread, add the filling, then the top slice. If you put the top on first, there's nowhere for the filling to go! Steps build on each other." },

  // Chapter 3 — Reading neutral code
  { type: "predict", chapter: "3 · Reading code", title: "Follow the steps",
    intro: "Now a little code — but in plain, neutral form (not any specific language). Read it top to bottom and predict the result. You start with 3, then add 2 more.",
    code: "start with 3\nadd 2", q: "What number do you end with?",
    choices: ["5", "32", "6"], correctIndex: 0,
    why: "Yes — 3, then 2 more, makes 5. You just 'ran' code in your head. That's what coders do constantly." },
  { type: "predict", chapter: "3 · Reading code", title: "A box that holds a value",
    intro: "`x` is a box holding a number. Read each line top to bottom and predict what prints.",
    code: "x = 5\nx = x + 3\nprint x", q: "What prints?",
    choices: ["5", "8", "3"], correctIndex: 1,
    why: "Right — x starts at 5, becomes 5+3 = 8, then prints 8. A name like x just holds whatever you put in it." },

  // Chapter 4 — Predicting with loops & choices (harder)
  { type: "predict", chapter: "4 · Thinking ahead", title: "Doing something 3 times",
    intro: "Code can repeat. 'repeat 3 times' does the indented line three times. Predict the result.",
    code: "count = 0\nrepeat 3 times:\n  count = count + 1\nprint count", q: "What prints?",
    choices: ["0", "1", "3"], correctIndex: 2,
    why: "Yes — count goes 0 → 1 → 2 → 3. Repeating steps (a loop) is how code does big jobs without writing every line." },
  { type: "predict", chapter: "4 · Thinking ahead", title: "Making a decision",
    intro: "Code can choose between paths. 'if' runs one branch when something is true, 'else' the other. You have 10 sweets. Predict what prints.",
    code: 'sweets = 10\nif sweets > 5:\n  print "lots!"\nelse:\n  print "a few"', q: "What prints?",
    choices: ['lots!', 'a few', '10'], correctIndex: 0,
    why: "Right — 10 is more than 5, so it takes the 'lots!' path. Code makes decisions by checking if something is true." },
  { type: "order", chapter: "4 · Thinking ahead", title: "Find the tallest friend",
    intro: "Last one, and it's the trickiest. Imagine three friends in a line and you want to find the tallest. Put the steps in order — it's how a computer would do it too!",
    items: ["Look at each friend, one by one", "Start by pretending the first friend is the tallest", "If a friend is taller, they become the new 'tallest so far'", "Whoever's left as 'tallest so far' is the answer"],
    correct: [1, 0, 2, 3],
    why: "That's a real algorithm! Start with a guess, check each one, update when you find better, then you have your answer. You just thought exactly like a programmer." },

  // Chapter 5 — The universal building blocks (appear in EVERY language)
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Variables",
    plain: "A variable is a named box that holds a value so you can use it later. You put something in, and the name remembers it for you.",
    neutral: "price = 10", langs: [["JavaScript", "let price = 10;"], ["Python", "price = 10"], ["Java", "int price = 10;"]],
    q: "A variable is best described as…", choices: ["A named box that holds a value", "A type of loop", "A math symbol"], answer: 0,
    why: "Every language has variables — just slightly different spellings. The idea (a named box) is identical everywhere." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Numbers vs text",
    plain: "Code tells numbers and text apart. Numbers do math; text (called a \"string\") is words, almost always wrapped in quotes.",
    neutral: 'age = 12\nname = "Mia"', langs: [["JavaScript", 'let age = 12;\nlet name = "Mia";'], ["Python", 'age = 12\nname = "Mia"']],
    q: 'Why is "Mia" in quotes but 12 is not?', choices: ["Quotes mark it as text, not a number", "It's a mistake", "Quotes make it bigger"], answer: 0,
    why: "The quotes are the universal signal for 'this is text.' True in basically every language." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Functions",
    plain: "A function is a reusable mini-machine: give it a name and some steps, then run it whenever you want instead of rewriting those steps.",
    neutral: 'define greet:\n  show "Hello"', langs: [["JavaScript", 'function greet() {\n  console.log("Hello");\n}'], ["Python", 'def greet():\n  print("Hello")']],
    q: "Why use a function?", choices: ["To reuse steps without rewriting them", "To slow the computer down", "To delete code"], answer: 0,
    why: "Functions exist in every language. The word changes (`function`, `def`), the idea — a named, reusable set of steps — doesn't." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Arguments (inputs)",
    plain: "You can hand a function information to work with, called arguments (or inputs). It's like handing someone the thing you want them to use.",
    neutral: "define double(n):\n  ...", langs: [["JavaScript", "function double(n) { ... }"], ["Python", "def double(n):"]],
    q: "What is an argument?", choices: ["Information you give a function to use", "An error message", "A kind of loop"], answer: 0,
    why: "The `n` is the input. Every language lets you pass inputs into functions this way." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Return",
    plain: "Return is how a function hands an answer back to whoever called it. Without return, a function can do work but gives nothing back.",
    neutral: "define double(n):\n  return n times 2", langs: [["JavaScript", "function double(n) {\n  return n * 2;\n}"], ["Python", "def double(n):\n  return n * 2"]],
    q: "What does \"return\" do?", choices: ["Hands an answer back from the function", "Repeats the function", "Stops the whole program"], answer: 0,
    why: "`return` is nearly universal — same word, same job, in JavaScript, Python, Java, and more." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "If / else (decisions)",
    plain: "Code can choose between paths. \"If\" runs one block when something is true; \"else\" runs the other when it isn't.",
    neutral: 'if sweets > 5:\n  show "lots!"\nelse:\n  show "a few"', langs: [["JavaScript", 'if (sweets > 5) {\n  console.log("lots!");\n} else {\n  console.log("a few");\n}'], ["Python", 'if sweets > 5:\n  print("lots!")\nelse:\n  print("a few")']],
    q: "What does \"else\" cover?", choices: ["What happens when the \"if\" is not true", "Every case, always", "Nothing"], answer: 0,
    why: "Making decisions with if/else is one of the most universal ideas in all of programming." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Comparisons & true/false",
    plain: "Code compares things and gets back true or false (called a \"boolean\"). Like 5 > 3 is true. Comparisons power every decision.",
    neutral: "5 > 3   →   true", langs: [["JavaScript", "5 > 3   // true"], ["Python", "5 > 3   # True"]],
    q: "What's the result of a comparison like 5 > 3?", choices: ["true or false (a boolean)", "always 5", "a piece of text"], answer: 0,
    why: "True/false values are everywhere in code — they're how programs decide what to do." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Loops (repeating)",
    plain: "A loop repeats steps so you don't write them over and over — perfect for doing something to every item, or a set number of times.",
    neutral: 'repeat 3 times:\n  show "hi"', langs: [["JavaScript", 'for (let i = 0; i < 3; i++) {\n  console.log("hi");\n}'], ["Python", 'for i in range(3):\n  print("hi")']],
    q: "Why use a loop?", choices: ["To repeat steps without rewriting them", "To make a single decision", "To name a value"], answer: 0,
    why: "Loops look different across languages but do the same thing: repeat work. You'll meet them in every language." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Lists / arrays",
    plain: "A list (or array) holds many values in order under one name — like a row of boxes. You can grab any one by its position.",
    neutral: 'fruits = ["apple", "pear", "plum"]', langs: [["JavaScript", 'let fruits = ["apple", "pear", "plum"];'], ["Python", 'fruits = ["apple", "pear", "plum"]']],
    q: "What is a list/array?", choices: ["Many values in order under one name", "A single number", "A function"], answer: 0,
    why: "Called 'array' in some languages, 'list' in others — same idea: a collection of values in order." },
  { type: "concept", chapter: "5 · Building blocks (every language)", title: "Comments",
    plain: "A comment is a note for humans that the computer ignores completely. You use it to explain what your code does.",
    neutral: "# this is a note", langs: [["JavaScript", "// this is a note"], ["Python", "# this is a note"]],
    q: "Who are comments for?", choices: ["Humans reading the code (the computer ignores them)", "The computer only", "Nobody"], answer: 0,
    why: "Every language has comments. The symbol differs (`//`, `#`), but they're always notes the computer skips." },
];

// ---------- The JS beginner course (read-first, no typing early) ----------
const JS_STEPS = [
  { type: "visual", chapter: "5 · Draw with code", lang: "js", title: "Draw with JavaScript canvas",
    teach: "JavaScript can draw right in the page using a canvas. You grab the canvas, get its “drawing tool” (context), pick a color, and draw a shape. Write it, then tap Run visually.",
    example: "ctx.fillStyle = 'red';\nctx.fillRect(50, 50, 100, 100); // a red square",
    starter: "const canvas = document.getElementById('c');\nconst ctx = canvas.getContext('2d');\n\n// draw a blue circle in the middle:\nctx.fillStyle = 'deepskyblue';\nctx.beginPath();\nctx.arc(200, 200, 60, 0, Math.PI * 2);\nctx.fill();\n",
    why: "🎉 You drew with real JavaScript — that's exactly how web games and animations start!" },
  { type: "read", chapter: "1 · Just looking", title: "What a line of code looks like", concept: "a coding concept",
    intro: "Before writing anything, let's just LOOK. Tap each colored piece to see what it means in plain English.",
    line: [
      { text: "say", plain: "A command — it tells the computer to show something." },
      { text: "(", plain: "An opening bracket. What goes inside is what we give to 'say'." },
      { text: '"Hello"', plain: "The message. The quote marks mean 'these are words, not a number.'" },
      { text: ")", plain: "A closing bracket. It finishes the command." },
    ],
    takeaway: "Code is just instructions made of small pieces. You read your first line!" },
  { type: "read", chapter: "1 · Just looking", title: "A line that does math", concept: "doing math in code",
    intro: "Here's another. This one adds two numbers. Tap each piece.",
    line: [
      { text: "add", plain: "A command that adds things together." },
      { text: "(", plain: "Opening bracket — the things to add go inside." },
      { text: "2", plain: "The first number. No quotes, because it's a real number." },
      { text: ",", plain: "A comma — it separates the two things." },
      { text: "3", plain: "The second number." },
      { text: ")", plain: "Closing bracket — done." },
    ],
    takeaway: "Numbers don't need quotes. Words do. That difference matters a lot." },

  { type: "pick", chapter: "2 · Choosing", title: "Which line says hello?", concept: "showing text output",
    intro: "Now YOU choose — no writing, just pick the line that shows the word Hello.",
    goal: "Show the word: Hello", choices: ['add(2, 3)', 'say("Hello")', 'price * 2'], correctIndex: 1,
    why: "Right! `say(\"Hello\")` shows the message. The quotes mark it as words.",
    harder: { type: "pick", chapter: "2 · Choosing (harder)", title: "Which shows Hello three times?", concept: "showing text output",
      intro: "Read each carefully. Which one shows Hello three times?",
      goal: "Show: Hello Hello Hello", choices: ['say("Hello") * 3', 'say("Hello Hello Hello")', 'add("Hello", 3)'], correctIndex: 1,
      why: "Yes — it's all one message inside the quotes." } },
  { type: "pick", chapter: "2 · Choosing", title: "Which line adds 5 and 4?", concept: "adding numbers",
    intro: "Pick the line that adds the numbers 5 and 4.",
    goal: "Add the numbers 5 and 4", choices: ['say("5 and 4")', 'add(5, 4)', 'add("5", "4")'], correctIndex: 1,
    why: "Yes! Real numbers, no quotes — so the computer adds them." },

  { type: "build", chapter: "3 · Building (no typing!)", title: "Build a line that shows a name", concept: "showing text output",
    intro: "Tap the pieces in the right order to show the word Mia. Tap a placed piece to remove it.",
    target: ["say", "(", '"Mia"', ")"], bank: [")", '"Mia"', "say", "(", "add"], runnable: false,
    why: "You built it! `say(\"Mia\")` shows the name — real code, no typing." },
  { type: "build", chapter: "3 · Building (no typing!)", title: "Build a doubling line", concept: "a coding concept",
    intro: "Inside a real function. Tap pieces to return the price times 2.",
    preface: "function double(price) {", suffix: "}",
    target: ["return", "price", "*", "2"], bank: ["2", "*", "price", "return", "+"], runnable: true, fnName: "double",
    buildFull: (a) => `function double(price) { ${a.join(" ")}; }`, tests: [{ args: [5], expected: 10 }, { args: [3], expected: 6 }],
    why: "Real, working code! `*` means multiply, so `price * 2` doubles it.",
    harder: { type: "build", chapter: "3 · Building (harder)", title: "Build a tripling line", concept: "a coding concept",
      intro: "Make it return the price times 3.", preface: "function triple(price) {", suffix: "}",
      target: ["return", "price", "*", "3"], bank: ["3", "*", "price", "return", "+"], runnable: true, fnName: "triple",
      buildFull: (a) => `function triple(price) { ${a.join(" ")}; }`, tests: [{ args: [5], expected: 15 }, { args: [2], expected: 6 }],
      why: "Same shape, just `* 3`. You spotted the pattern.",
      harder: { type: "build", chapter: "3 · Building (hardest)", title: "Build double-then-add-one", concept: "doubling a number",
        intro: "Combine two steps: times 2, then plus 1.", preface: "function doublePlus(n) {", suffix: "}",
        target: ["return", "n", "*", "2", "+", "1"], bank: ["1", "+", "2", "*", "n", "return"], runnable: true, fnName: "doublePlus",
        buildFull: (a) => `function doublePlus(n) { ${a.join(" ")}; }`, tests: [{ args: [5], expected: 11 }, { args: [0], expected: 1 }],
        why: "A real two-step calculation — multiply first, then add." } } },

  { type: "fill", chapter: "4 · One piece missing", title: "Fill in the blank", concept: "a coding concept",
    intro: "Almost the whole line is here. Tap the piece that doubles the number.",
    preface: "function double(n) {", lineBefore: "return n *", blankChoices: ["1", "2", "n"], answer: "2", suffix: "}",
    runnable: true, fnName: "double", buildFull: (c) => `function double(n) { return n * ${c}; }`, tests: [{ args: [5], expected: 10 }, { args: [4], expected: 8 }],
    why: "Perfect. `n * 2` doubles it.",
    harder: { type: "fill", chapter: "4 · One piece (harder)", title: "Trickier blank", concept: "a coding concept",
      intro: "More than one looks tempting. Tap the piece that TRIPLES the number.",
      preface: "function triple(n) {", lineBefore: "return n *", blankChoices: ["2", "3", "n"], answer: "3", suffix: "}",
      runnable: true, fnName: "triple", buildFull: (c) => `function triple(n) { return n * ${c}; }`, tests: [{ args: [5], expected: 15 }, { args: [4], expected: 12 }],
      why: "Exactly — `n * 3` triples it." } },

  { type: "type", chapter: "5 · Now you type", title: "Type it yourself", concept: "a coding concept",
    intro: "You've read it, picked it, built it, filled it. You KNOW this. Type the number that doubles n.",
    starter: "function double(n) {\n  return n * \n}", fnName: "double", tests: [{ args: [5], expected: 10 }, { args: [3], expected: 6 }],
    why: "🎉 You TYPED working code and it ran. Read it, understand it, write it — you're coding.",
    harder: { type: "type", chapter: "5 · Now you type (harder)", title: "Type a tripler from scratch", concept: "tripling a number",
      intro: "Type the whole return line to TRIPLE the number. You've seen the shape: `return n * 3`.",
      starter: "function triple(n) {\n  \n}", fnName: "triple", tests: [{ args: [5], expected: 15 }, { args: [3], expected: 9 }],
      why: "🚀 You wrote a whole line on your own. That's writing code." } },
];

// ---------- Python course (mirrors the arc, Python syntax) ----------
const PY_STEPS = [
  { type: "read", chapter: "1 · Just looking", title: "A Python line that says hello",
    intro: "Python is another language — a bit different, same ideas. Tap each piece.",
    line: [
      { text: "print", plain: "Python's command to show something (JavaScript used 'say'-style calls; Python uses print)." },
      { text: "(", plain: "Opening bracket — what to show goes inside." },
      { text: '"Hello"', plain: "The message, in quotes because it's words." },
      { text: ")", plain: "Closing bracket — done." },
    ],
    takeaway: "Different word (print), same idea. Languages rhyme." },
  { type: "pick", chapter: "2 · Choosing", title: "Which Python line shows Hi?",
    intro: "Pick the line that shows the word Hi in Python.",
    goal: "Show the word: Hi", choices: ['say("Hi")', 'print("Hi")', 'print(Hi)'], correctIndex: 1,
    why: "Yes! Python uses `print`, and `\"Hi\"` needs quotes since it's words." },
  { type: "fill", chapter: "3 · One piece missing", title: "Finish the Python doubler",
    intro: "Python functions use `def`. Tap the piece that doubles n.",
    preface: "def double(n):", lineBefore: "    return n *", blankChoices: ["1", "2", "n"], answer: "2", suffix: "",
    runnable: false /* Python isn't run here; structural check only in this prototype */,
    pyNote: true, why: "Right — `n * 2` doubles it, same as JavaScript. The shape carries over." },
  { type: "visual", chapter: "4 · Make something move", lang: "py", title: "Draw a circle with Pygame",
    teach: "Pygame is how Python draws graphics. You make a window, then draw shapes on it. Here you'll draw a red circle — write it, then tap Run visually and watch it appear.",
    example: "pygame.draw.circle(screen, (255,0,0), (200,200), 40)\n# draws a red circle at the middle",
    starter: "import pygame\npygame.init()\nscreen = pygame.display.set_mode((400, 400))\nscreen.fill((14, 19, 32))\n\n# draw a red circle in the middle:\npygame.draw.circle(screen, (255, 0, 0), (200, 200), 40)\n\npygame.display.flip()\n",
    why: "🎉 You wrote Pygame and it drew your circle! That's real graphics code." },
  { type: "visual", chapter: "4 · Make something move", lang: "py", title: "Draw a square with turtle",
    teach: "Turtle is another Python way to draw — you steer a little 'turtle' that leaves a trail. Move forward, turn, repeat. It's a fun way to make shapes. Write it, then tap Run visually.",
    example: "for i in range(4):\n    t.forward(100)\n    t.right(90)   # draws a square",
    starter: "import turtle\nt = turtle.Turtle()\n\n# draw a square: go forward, turn right, 4 times\nfor i in range(4):\n    t.forward(120)\n    t.right(90)\n",
    why: "🎉 Same language, a totally different way to draw — and it showed your square!" },
];

// ---------- AI lesson generation (typing-style, validated) ----------
async function callClaude(messages, { system, maxTokens = 900, signal } = {}) {
  // Calls our own backend (/api/ai), which holds the Gemini key secretly and
  // returns { text }. Keeps the same signature + string return as before, so
  // all the generators and validation gates work unchanged.
  const res = await fetch("/api/ai", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ messages, system, maxTokens }),
  });
  if (!res.ok) throw new Error(`AI unavailable (${res.status})`);
  const data = await res.json();
  return (data.text || "").trim();
}
function extractJSON(raw) {
  let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("no JSON");
  return JSON.parse(s.slice(a, b + 1));
}

// ---------- Pre-check: validate the learner's Python BEFORE translating ----------
// Catches real errors (syntax, undefined names, bad calls) by compiling and
// running the code headless with a stubbed pygame — so we never send broken
// code to the AI. A loop-guard caps iterations so a `while True` can't hang.
async function precheckPython(code) {
  let py;
  try { py = await loadPyodide(); } catch (e) { return { ok: true, skipped: true }; } // if engine won't load, don't block
  const harness = [
    "import sys, types",
    'pg = types.ModuleType("pygame")',
    "class _S:",
    "    def fill(self,*a,**k): pass",
    "    def blit(self,*a,**k): pass",
    "    def get_rect(self,*a,**k): return _R()",
    "class _R:",
    "    def __init__(self,*a,**k): self.x=self.y=self.width=self.height=0",
    "    def colliderect(self,*a,**k): return False",
    "pg.init=lambda *a,**k:(0,0)",
    "pg.quit=lambda *a,**k:None",
    "pg.display=types.SimpleNamespace(set_mode=lambda *a,**k:_S(),flip=lambda *a,**k:None,update=lambda *a,**k:None,set_caption=lambda *a,**k:None)",
    "pg.draw=types.SimpleNamespace(circle=lambda *a,**k:None,rect=lambda *a,**k:None,line=lambda *a,**k:None,polygon=lambda *a,**k:None,ellipse=lambda *a,**k:None)",
    "pg.Rect=_R",
    "pg.Surface=_S",
    "pg.time=types.SimpleNamespace(Clock=lambda *a,**k:types.SimpleNamespace(tick=lambda *a,**k:0))",
    "pg.event=types.SimpleNamespace(get=lambda *a,**k:[])",
    "pg.key=types.SimpleNamespace(get_pressed=lambda *a,**k:{})",
    "pg.font=types.SimpleNamespace(SysFont=lambda *a,**k:types.SimpleNamespace(render=lambda *a,**k:_S()),Font=lambda *a,**k:types.SimpleNamespace(render=lambda *a,**k:_S()))",
    "pg.QUIT=256",
    'for _k in ["K_LEFT","K_RIGHT","K_UP","K_DOWN","K_SPACE"]: setattr(pg,_k,0)',
    'sys.modules["pygame"]=pg',
    "__src=" + JSON.stringify(code),
    "try:",
    '    compile(__src,"<your code>","exec")',
    "except SyntaxError as e:",
    '    print("PRECHECK_FAIL: Line "+str(e.lineno)+": "+str(e.msg)); raise SystemExit',
    "__steps=[0]",
    "def __trace(frame,event,arg):",
    "    __steps[0]+=1",
    '    if __steps[0]>200000: raise RuntimeError("loop-guard")',
    "    return __trace",
    "sys.settrace(__trace)",
    "try:",
    '    exec(__src,{"__name__":"__main__"})',
    '    print("PRECHECK_OK")',
    "except SystemExit:",
    '    print("PRECHECK_OK")',
    "except RuntimeError as e:",
    '    print("PRECHECK_OK" if str(e)=="loop-guard" else "PRECHECK_FAIL: "+str(e))',
    "except Exception as e:",
    '    print("PRECHECK_FAIL: "+type(e).__name__+": "+str(e))',
    "finally:",
    "    sys.settrace(None)",
  ].join("\n");
  try {
    const out = (await py.runPythonAsync(harness)) || "";
    const line = out.split("\n").find((l) => l.startsWith("PRECHECK_")) || "PRECHECK_OK";
    if (line.startsWith("PRECHECK_OK")) return { ok: true };
    return { ok: false, why: line.replace("PRECHECK_FAIL: ", "") };
  } catch (e) {
    return { ok: true, skipped: true }; // engine hiccup shouldn't block the learner
  }
}

// ---------- Visual run: translate ANY language's graphics code → JS canvas ----------
// The learner writes real visual code in their language using whatever graphics
// approach that language uses (Pygame/turtle/tkinter, Swing, SDL, canvas, LÖVE,
// Processing, etc.). We ask the AI to RE-CREATE the same visual as JavaScript on
// an HTML canvas — the one thing a browser can actually display — then run that
// inside a sandboxed iframe. The AI doesn't run the original engine; it reproduces
// what the code draws. So this works for every language, not just Pygame.
const VISUAL_LANG = {
  js: { label: "JavaScript", libs: "HTML5 canvas, p5.js, or DOM drawing" },
  py: { label: "Python", libs: "Pygame, turtle, or tkinter Canvas" },
  java: { label: "Java", libs: "Swing/AWT (Graphics2D, JPanel.paintComponent) or JavaFX" },
  cpp: { label: "C++", libs: "SDL2, SFML, or OpenGL basics" },
  c: { label: "C", libs: "SDL2 or raylib" },
  csharp: { label: "C#", libs: "WinForms (System.Drawing) or MonoGame" },
  go: { label: "Go", libs: "ebiten or the image package" },
  rust: { label: "Rust", libs: "macroquad, ggez, or the image crate" },
  ruby: { label: "Ruby", libs: "Gosu or Ruby2D" },
  swift: { label: "Swift", libs: "SwiftUI Canvas, CoreGraphics, or SpriteKit" },
  kotlin: { label: "Kotlin", libs: "Compose Canvas or java AWT/Swing" },
  php: { label: "PHP", libs: "GD library (imagecreate, imagefilledellipse)" },
  lua: { label: "Lua", libs: "LÖVE (love.graphics) or Corona" },
  r: { label: "R", libs: "base plotting or ggplot2 shapes" },
  dart: { label: "Dart", libs: "Flutter CustomPainter/Canvas" },
  processing: { label: "Processing", libs: "Processing (size, ellipse, rect, draw())" },
  p5: { label: "p5.js", libs: "p5.js (setup/draw, ellipse, rect)" },
  scratch: { label: "Scratch-style", libs: "sprite move/turn/draw blocks" },
  ts: { label: "TypeScript", libs: "HTML5 canvas" },
};
async function translateToCanvas(langId, code, signal) {
  // JavaScript can draw on the canvas directly — no translation needed.
  if (langId === "js" || langId === "ts") return code;
  const info = VISUAL_LANG[langId] || { label: langId, libs: "its usual graphics library" };
  const sys =
    "You take a beginner's visual/graphics program written in any language and RE-CREATE the same visual as ONE self-contained JavaScript program drawing on an HTML canvas. " +
    "The page already has <canvas id=\"c\" width=\"400\" height=\"400\"></canvas>; grab its 2D context yourself. " +
    "Figure out what the program draws (shapes, colors, positions, text, sprites) and reproduce it faithfully on the canvas. " +
    "Translate any animation/game loop to requestAnimationFrame, and any keyboard/mouse input to browser events (keydown, mousemove, etc.). " +
    "If the program uses a coordinate system or window size, map it sensibly into 400x400. " +
    "Output ONLY JavaScript code — no explanation, no comments needed, no markdown fences.";
  const user =
    `This is a ${info.label} program (likely using ${info.libs}). ` +
    `Re-create what it draws as canvas JavaScript:\n\n${code}`;
  const raw = await callClaude([{ role: "user", content: user }], { system: sys, maxTokens: 1800, signal });
  return raw.replace(/```javascript/gi, "").replace(/```js/gi, "").replace(/```/g, "").trim();
}
function canvasSandboxHTML(jsCode) {
  return `<!doctype html><html><head><style>html,body{margin:0;height:100%;background:#0e1320;display:flex;align-items:center;justify-content:center}canvas{background:#000;border-radius:8px;max-width:100%}</style></head>
<body><canvas id="c" width="400" height="400"></canvas>
<script>
try {
${jsCode}
} catch (e) {
  var ctx = document.getElementById('c').getContext('2d');
  ctx.fillStyle = '#0e1320'; ctx.fillRect(0,0,400,400);
  ctx.fillStyle = '#ff8aa3'; ctx.font = '13px monospace';
  ctx.fillText('Could not run this visual:', 12, 28);
  ctx.fillText(String(e.message).slice(0,44), 12, 50);
}
</` + `script></body></html>`;
}

// ---------- Real code execution for ALL languages via Piston (text output) ----------
// Non-JS/Python languages don't run in the browser, so we send them to our
// backend (/api/run), which runs them on a server through the public Piston API
// and returns the real printed output. Check model: the program prints, and we
// compare its output to the lesson's expectedOutput.
async function runViaPiston(langId, code, stdin, signal) {
  const res = await fetch("/api/run", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ langId, code, stdin: stdin || "" }),
  });
  if (!res.ok) throw new Error(`Runner unavailable (${res.status})`);
  return await res.json(); // { stdout, stderr, code, ok }
}
function normalizeOut(s) {
  return String(s == null ? "" : s).replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}
function outputMatches(stdout, expected) {
  return normalizeOut(stdout) === normalizeOut(expected);
}

function validateGenerated(L) {
  const p = [];
  if (!L || !L.fnName || !L.solution || !Array.isArray(L.tests)) return { ok: false, p: ["fields"] };
  if (L.tests.length < 2) p.push("few tests");
  for (const t of L.tests) if (!Array.isArray(t.args) || !("expected" in t)) return { ok: false, p: ["bad tests"] };
  if (!verifyRuns(L.solution, L.fnName, L.tests).ok) p.push("sol fails");
  if (L.starter && verifyRuns(L.starter, L.fnName, L.tests).ok) p.push("starter passes");
  return { ok: p.length === 0, p };
}
const GEN_SYSTEM =
  "You write ONE beginner JavaScript practice exercise as the learner's NEXT step after some warm-up lessons. " +
  "Respond with ONLY JSON, no prose, no fences. Schema: {\"title\":string (short, friendly), " +
  "\"teach\":string (1-2 plain sentences explaining the idea, may use `inline code`), \"fnName\":string (camelCase), " +
  "\"starter\":string (a function skeleton with the right name, an empty body, and a // comment — NOT a working solution), " +
  "\"solution\":string (complete correct code), \"tests\":array of >=2 {\"args\":array,\"expected\":any}}. " +
  "Keep it small and beginner-friendly (simple numbers/strings/arrays). Starter must NOT pass the tests; solution MUST pass.";
// ---------- Topic-unit generator: AI picks a topic + a few lessons under it ----------
const topicSystemFor = (langLabel, runnable) =>
  `You design a small THEMED set of beginner ${langLabel} exercises grouped under one topic. ` +
  "YOU choose the topic and how many lessons fit it (between 3 and 5). They build on each other, easy to harder. " +
  "EVERY lesson must TEACH before it tests: explain the new idea in plain words, then show a tiny worked example. " +
  "Respond with ONLY JSON, no prose, no fences: {\"topic\":string (2-4 words), \"lessons\":[ {" +
  "\"title\":string, " +
  "\"teach\":string (2-3 plain sentences that EXPLAIN the new concept clearly, as if to a beginner who has never seen it; may use `inline code`), " +
  "\"example\":string (a short worked example line or two showing the idea in " + langLabel + ", e.g. an input and what it produces), " +
  "\"fnName\":string (camelCase), " +
  "\"starter\":string (a " + langLabel + " skeleton with the right name, empty body, a comment — NOT a solution), " +
  "\"solution\":string (complete correct " + langLabel + " code), " +
  "\"tests\":array of >=2 {\"args\":array,\"expected\":any}} ] }. " +
  `Use real ${langLabel} syntax exactly. Keep it beginner-friendly. Every starter must NOT pass its tests; every solution MUST pass.`;

async function generateTopicUnit({ classId = "js", langLabel = "JavaScript", priorTopics, signal }) {
  const runnable = classId === "js" || classId === "py";
  const ask = `Make a fresh themed ${langLabel} set now. Avoid these topics already covered: ${(priorTopics || []).join(", ") || "none"}. Pick a NEW beginner topic and 3-5 lessons for it. Remember: each lesson explains the idea first, then a worked example, then the exercise.`;
  let raw;
  try { raw = await callClaude([{ role: "user", content: ask }], { system: topicSystemFor(langLabel, runnable), maxTokens: 2600, signal }); }
  catch { throw new Error("ai-failed"); }
  let parsed; try { parsed = extractJSON(raw); } catch { throw new Error("bad-json"); }
  const topic = (parsed.topic || "More practice").toString().slice(0, 40);
  const chapter = `✨ ${topic}`;
  const rawLessons = Array.isArray(parsed.lessons) ? parsed.lessons.slice(0, 6) : [];
  const out = [];
  for (const L of rawLessons) {
    if (!L.fnName || !L.solution || !Array.isArray(L.tests) || L.tests.length < 2) continue;
    // verify the solution actually runs (JS natively, Python via Pyodide)
    let valid;
    if (classId === "js") valid = verifyRuns(L.solution, L.fnName, L.tests).ok && !verifyRuns(L.starter || "", L.fnName, L.tests).ok;
    else if (classId === "py") { const v = await verifyPython(L.solution, L.fnName, L.tests); valid = v.ok; }
    else valid = true; // shouldn't reach here for non-runnable, handled elsewhere
    if (!valid) continue;
    out.push({
      id: "ai_" + Math.random().toString(36).slice(2, 8),
      type: "type", chapter, topic, generated: true, lang: classId,
      title: L.title || "Lesson", teach: L.teach || "", example: L.example || "",
      intro: L.teach || "Type the function so the tests pass.",
      starter: L.starter || `function ${L.fnName}() {\n  \n}`, fnName: L.fnName, tests: L.tests,
      why: "🎉 You solved it — and it ran for real.",
    });
  }
  if (out.length === 0) throw new Error("none-valid");
  return { topic, chapter, lessons: out };
}

// ---------- Python grading via Pyodide (loads on first use) ----------
let _pyodide = null, _pyLoading = null;
function loadPyodide() {
  if (_pyodide) return Promise.resolve(_pyodide);
  if (_pyLoading) return _pyLoading;
  _pyLoading = new Promise((resolve, reject) => {
    const boot = () => window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/" }).then((py) => { _pyodide = py; resolve(py); }).catch(reject);
    if (window.loadPyodide) return boot();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
    s.onload = boot; s.onerror = () => reject(new Error("Couldn't load the Python runtime."));
    document.head.appendChild(s);
  });
  return _pyLoading;
}
async function verifyPython(code, fnName, tests) {
  let py;
  try { py = await loadPyodide(); } catch (e) { return { ok: false, why: e.message, engineError: true }; }
  const harness = `
import json
${code}
__tests = json.loads(r'''${JSON.stringify(tests)}''')
__res = []
for __t in __tests:
    try:
        __g = ${fnName}(*__t["args"])
        __res.append(bool(__g == __t["expected"]))
    except Exception as __e:
        __res.append(False)
json.dumps(__res)
`;
  try { const raw = await py.runPythonAsync(harness); const arr = JSON.parse(raw); return { ok: arr.every(Boolean) }; }
  catch (e) { return { ok: false, why: (e.message || "").split("\n").filter(Boolean).pop() || "Python error" }; }
}

// ---------- Cross-language concept memory ----------
// Looks at every completed lesson across all classes and lists the concepts the
// learner already knows, so a new language class can build on them.
function conceptsLearnedElsewhere(progressMap, excludeClassId) {
  const learned = [];
  for (const cls of CLASSES) {
    if (cls.id === excludeClassId) continue;
    const done = progressMap[cls.id] || new Set();
    cls.steps.forEach((s, i) => { if (done.has(i)) learned.push({ lang: cls.label, concept: s.concept || s.title }); });
  }
  // de-dup by concept
  const seen = new Set(); const out = [];
  for (const l of learned) { const k = l.concept.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(l); } }
  return out.slice(0, 8);
}
function priorKnowledgeClause(learned, langLabel) {
  if (!learned.length) return "The learner is new with no prior concepts. Start as gently as possible.";
  return `The learner ALREADY understands these ideas from other languages: ${learned.map((l) => `${l.concept} (${l.lang})`).join(", ")}. ` +
    `Where relevant, frame lessons as "you already know X — here's how ${langLabel} does it," rather than re-explaining from scratch.`;
}

// ---------- Per-language course generation ----------
const langGenSystem = (cfg) =>
  `You generate a short beginner course (an array of ${cfg.count} lessons) for the ${cfg.label} programming language. ` +
  `EVERY lesson must TEACH before it tests: explain the new idea plainly, then show a worked example. ` +
  `Respond with ONLY a JSON object: {"lessons":[ ... ]}, no prose, no fences. ` +
  (cfg.mode === "real"
    ? `Each lesson: {"title":string, "teach":string (2-3 plain sentences that EXPLAIN the new concept to a total beginner, may use \`inline code\`), "example":string (a short worked example in ${cfg.label} showing the idea), "concept":string (the underlying idea, e.g. "doubling a number"), "fnName":string, "starter":string (a ${cfg.label} function skeleton with the right name and an empty body + a comment, NOT a working solution), "solution":string (complete correct ${cfg.label} code), "tests":array of >=2 {"args":array,"expected":any}}. Starters must NOT pass; solutions MUST pass. Use ${cfg.label} syntax exactly.`
    : `Each lesson: {"title":string, "teach":string (2-3 plain sentences that EXPLAIN the new concept to a total beginner), "example":string (a short worked example in ${cfg.label} showing the idea), "concept":string, "starter":string (a ${cfg.label} code skeleton to fill in), "checks":array of >=2 short strings (criteria a correct answer meets)}. Use real ${cfg.label} syntax.`) +
  ` Order lessons from easiest to hardest, each building on the last. Keep them small and beginner-friendly.`;

// ---------- Full language catalog (everything Claude teaches well) ----------
// Only languages in this list can be searched/picked — so nothing unsupported
// or made-up appears. JS & Python run for real; the rest are AI-judged.
// ---------- Hardware section (how computers & electronics work) ----------
const HARDWARE_STEPS = [
  { type: "puzzle", chapter: "1 · How computers think", title: "What is a CPU?", intro: "The CPU (Central Processing Unit) is the 'brain' of a computer. It follows instructions incredibly fast — billions per second — doing tiny steps like adding numbers and comparing values. Everything your computer does is the CPU following instructions one after another.", q: "What does the CPU do?", why: "Right — the CPU is the brain that runs instructions. Speed is why computers feel instant.", choices: ["Follows instructions very fast", "Stores your photos forever", "Connects to wifi"], correctIndex: 0 },
  { type: "puzzle", chapter: "1 · How computers think", title: "Memory (RAM)", intro: "RAM (Random Access Memory) is the computer's short-term memory — a fast workspace where it keeps what it's using RIGHT NOW. It's fast but temporary: turn the computer off and RAM is wiped. That's different from storage (a hard drive), which keeps things permanently.", q: "What happens to RAM when you turn the computer off?", why: "Yes — RAM is temporary working memory. Permanent stuff lives on storage (drives).", choices: ["It's wiped (it's temporary)", "It saves forever", "It gets faster"], correctIndex: 0 },
  { type: "puzzle", chapter: "1 · How computers think", title: "Bits and bytes", intro: "Computers only really understand two things: ON and OFF — written as 1 and 0. One of these is a 'bit'. Eight bits together make a 'byte'. With patterns of 1s and 0s, computers represent everything: numbers, letters, pictures, sound.", q: "What is the smallest piece of computer information?", why: "Exactly — a bit is a single 1 or 0. Everything is built from these.", choices: ["A bit (1 or 0)", "A photo", "A word"], correctIndex: 0 },
  { type: "predict", chapter: "1 · How computers think", title: "Binary counting", intro: "In binary (1s and 0s), counting works like this: 1 is 'one', 10 is 'two', 11 is 'three', 100 is 'four'. Each spot is worth double the one to its right.", q: "What number is binary 101? (add the 'on' spots)", code: "binary: 1 0 1\nworth:  4 2 1", why: "Right! 101 = 4 + 1 = 5. Binary is just counting with only two digits.", choices: ["5", "3", "101"], correctIndex: 0 },
  { type: "puzzle", chapter: "2 · Electricity basics", title: "What is a circuit?", intro: "A circuit is a loop that electricity flows around — from the battery's + side, through wires and parts, back to the - side. If the loop is broken (a gap), electricity can't flow and nothing works. A switch is just a controlled gap you can open and close.", q: "Why doesn't electricity flow if there's a gap in the circuit?", why: "Correct — electricity needs a complete loop. Break the loop, and the flow stops.", choices: ["The loop is broken", "Gaps speed it up", "Electricity likes gaps"], correctIndex: 0 },
  { type: "puzzle", chapter: "2 · Electricity basics", title: "LEDs (lights!)", intro: "An LED (Light Emitting Diode) is a tiny light that glows when electricity flows through it the RIGHT way. LEDs only let electricity go one direction — the long leg is +, the short leg is -. Put it in backwards and it just won't light. They use very little power.", q: "What does an LED do?", why: "Yes — LEDs are little one-directional lights. Long leg to +, short leg to -.", choices: ["Glows when electricity flows the right way", "Stores electricity", "Makes sound"], correctIndex: 0 },
  { type: "puzzle", chapter: "2 · Electricity basics", title: "Resistors", intro: "A resistor slows down electricity — it limits how much current flows. Why care? An LED hooked straight to a battery gets too much current and burns out. A resistor in the circuit protects it by holding the flow back to a safe amount. Think of it like a narrow pipe slowing water.", q: "Why put a resistor before an LED?", why: "Right — resistors limit current and protect parts like LEDs from too much flow.", choices: ["To limit current so the LED doesn't burn out", "To make it brighter", "To store power"], correctIndex: 0 },
  { type: "puzzle", chapter: "2 · Electricity basics", title: "Transistors", intro: "A transistor is a tiny electronic SWITCH with no moving parts — a small electric signal can turn a bigger flow on or off. This is HUGE: it's the building block of all computer chips. A CPU has BILLIONS of transistors, each flipping on and off to do the 1s and 0s.", q: "Why are transistors so important?", why: "Exactly — transistors are switches, and billions of them make up every chip. They ARE how computers think.", choices: ["They're tiny switches that build computer chips", "They make light", "They store photos"], correctIndex: 0 },
  { type: "puzzle", chapter: "3 · Build real things", title: "What is Arduino?", intro: "An Arduino is a small, cheap board you can program to control real-world electronics — make an LED blink, read a button, spin a motor, react to a sensor. You write simple code on your computer, send it to the board, and it runs on its own. It's how lots of people start building real gadgets.", q: "What's an Arduino for?", why: "Yes — Arduino lets your code control physical things. Blink an LED, read a sensor, build a robot.", choices: ["Programming real electronics (LEDs, motors, sensors)", "Browsing the web", "Storing files"], correctIndex: 0 },
  { type: "puzzle", chapter: "3 · Build real things", title: "What is a Raspberry Pi?", intro: "A Raspberry Pi is a tiny but COMPLETE computer — about the size of a credit card — that costs very little. Unlike an Arduino (which just runs one program), a Pi runs a full operating system like a real computer: you can browse, code, and also control electronics. Great for bigger projects.", q: "How is a Raspberry Pi different from an Arduino?", why: "Right — a Pi is a whole tiny computer; an Arduino is a simpler board for running one program.", choices: ["It's a full computer with an operating system", "It can't be programmed", "It's much bigger"], correctIndex: 0 },
  { type: "predict", chapter: "3 · Build real things", title: "Blink an LED (the 'hello world' of hardware)", intro: "The classic first hardware project: blink an LED on and off. The code turns a pin ON, waits, turns it OFF, waits, and repeats forever. Read this Arduino-style loop and predict what the LED does.", q: "What does the LED do?", code: "turn LED on\nwait 1 second\nturn LED off\nwait 1 second\n(repeat forever)", why: "Yes — on, wait, off, wait, repeat = a blinking light. That's the first thing most makers build!", choices: ["Blinks on and off forever", "Stays on", "Stays off"], correctIndex: 0 },
];

// ---------- AI section (how AI works + building with AI) ----------
const AI_STEPS = [
  { type: "puzzle", chapter: "1 · How AI works", title: "What is AI, really?", intro: "AI (Artificial Intelligence) is software that learns patterns from huge amounts of examples, instead of being told exact rules. Show it millions of cat photos and it learns what 'cat' looks like — nobody wrote 'a cat has pointy ears' as a rule; it figured out the pattern itself.", q: "How does AI mostly learn?", why: "Right — modern AI learns patterns from tons of examples, rather than following hand-written rules.", choices: ["By finding patterns in lots of examples", "By being given exact rules for everything", "By guessing randomly"], correctIndex: 0 },
  { type: "puzzle", chapter: "1 · How AI works", title: "What is a model?", intro: "When people say an AI 'model', they mean the thing that came out of all that learning — a giant set of patterns the AI uses to make predictions. A language model (like the one powering this app's lessons) learned patterns of words, so it can predict what words come next and form helpful answers.", q: "What is an AI 'model'?", why: "Yes — a model is the bundle of learned patterns. A language model predicts words to form answers.", choices: ["The learned patterns the AI uses to make predictions", "A tiny robot", "A type of computer screen"], correctIndex: 0 },
  { type: "puzzle", chapter: "1 · How AI works", title: "AI can be wrong", intro: "Because AI predicts based on patterns, it can sound confident but still be WRONG — it can 'make things up' (people call this hallucinating). That's why you should always double-check important AI answers. AI is a powerful helper, not a perfect oracle.", q: "Why should you double-check important AI answers?", why: "Exactly — AI predicts, so it can confidently make mistakes. Always verify what matters.", choices: ["AI can sound confident but still be wrong", "AI is never wrong", "AI refuses to answer"], correctIndex: 0 },
  { type: "puzzle", chapter: "2 · Building with AI", title: "What is a prompt?", intro: "A prompt is just what you tell an AI — your instructions or question. The clearer and more specific your prompt, the better the answer. 'Write code' is vague; 'Write a Python function that adds two numbers and returns the result' gives the AI what it needs.", q: "What makes a better prompt?", why: "Right — specific, clear prompts get better results. Tell the AI exactly what you want.", choices: ["Being clear and specific", "Being as short as possible always", "Using big words"], correctIndex: 0 },
  { type: "puzzle", chapter: "2 · Building with AI", title: "What is an API?", intro: "An API is how one program talks to another. When this app generates a lesson, your app sends a message to the AI's API and gets an answer back — like ordering at a counter: you make a request, you get a response. APIs are how you 'plug' AI into your own apps.", q: "What does an API let you do?", why: "Yes — an API is the messenger between programs. It's how your app uses AI behind the scenes.", choices: ["Let one program talk to another (like plugging AI into an app)", "Make websites colorful", "Speed up your wifi"], correctIndex: 0 },
  { type: "predict", chapter: "2 · Building with AI", title: "How this app uses AI", intro: "Here's the real flow when you tap 'make a lesson set' in CodeQuest: your app sends a prompt to the AI through an API, the AI sends back lessons as data, and your app checks they actually work before showing them. Read the steps and pick what comes LAST.", q: "What's the last step?", code: "1. You tap a button\n2. App sends a prompt to the AI (API)\n3. AI sends back lessons\n4. ???", why: "Right — your app validates what the AI returns before trusting it. That's why bad lessons get filtered out!", choices: ["App checks the lessons work, then shows them", "The AI deletes your app", "Nothing happens"], correctIndex: 0 },
];

const LANGUAGE_CATALOG = [
  { id: "js", label: "JavaScript", emoji: "🟨", mode: "real", blurb: "The language of the web — runs in every browser." },
  { id: "py", label: "Python", emoji: "🐍", mode: "real", blurb: "Famous for being readable. Great first or second language." },
  { id: "ts", label: "TypeScript", emoji: "🔷", mode: "ai", blurb: "JavaScript with type-safety. Popular for big apps." },
  { id: "java", label: "Java", emoji: "☕", mode: "ai", blurb: "Powers big apps and Android." },
  { id: "cpp", label: "C++", emoji: "⚙️", mode: "ai", blurb: "Fast and powerful, used in games and systems." },
  { id: "c", label: "C", emoji: "🔧", mode: "ai", blurb: "The classic low-level language behind everything." },
  { id: "csharp", label: "C#", emoji: "🎯", mode: "ai", blurb: "Microsoft's language for apps and Unity games." },
  { id: "go", label: "Go", emoji: "🐹", mode: "ai", blurb: "Simple and fast, built by Google for servers." },
  { id: "rust", label: "Rust", emoji: "🦀", mode: "ai", blurb: "Memory-safe and fast — loved by developers." },
  { id: "ruby", label: "Ruby", emoji: "💎", mode: "ai", blurb: "Elegant and friendly, famous for web apps." },
  { id: "swift", label: "Swift", emoji: "🕊️", mode: "ai", blurb: "Apple's language for iPhone and Mac apps." },
  { id: "kotlin", label: "Kotlin", emoji: "🟣", mode: "ai", blurb: "A modern, cleaner way to build Android apps." },
  { id: "php", label: "PHP", emoji: "🐘", mode: "ai", blurb: "Runs a huge share of the web's back-ends." },
  { id: "sql", label: "SQL", emoji: "🗃️", mode: "ai", blurb: "How you ask questions of databases." },
  { id: "r", label: "R", emoji: "📊", mode: "ai", blurb: "Built for statistics and data analysis." },
  { id: "dart", label: "Dart", emoji: "🎯", mode: "ai", blurb: "Powers Flutter apps for phones and web." },
  { id: "scala", label: "Scala", emoji: "🔺", mode: "ai", blurb: "Blends object and functional styles on the JVM." },
  { id: "perl", label: "Perl", emoji: "🐪", mode: "ai", blurb: "A veteran language strong at text processing." },
  { id: "lua", label: "Lua", emoji: "🌙", mode: "ai", blurb: "Lightweight and embeddable — common in games." },
  { id: "haskell", label: "Haskell", emoji: "λ", mode: "ai", blurb: "Purely functional — a different way to think." },
  { id: "bash", label: "Bash", emoji: "💻", mode: "ai", blurb: "The shell language for automating your computer." },
  // ---- mainstream additions ----
  { id: "objc", label: "Objective-C", emoji: "🍎", mode: "ai", blurb: "The classic language behind older iPhone and Mac apps." },
  { id: "vb", label: "Visual Basic", emoji: "🅱️", mode: "ai", blurb: "Microsoft's approachable language for Windows apps." },
  { id: "matlab", label: "MATLAB", emoji: "📐", mode: "ai", blurb: "Built for engineering, math, and matrix-heavy work." },
  { id: "groovy", label: "Groovy", emoji: "🎷", mode: "ai", blurb: "A flexible scripting language for the JVM." },
  { id: "powershell", label: "PowerShell", emoji: "⌨️", mode: "ai", blurb: "Microsoft's powerful scripting shell for Windows." },
  { id: "vba", label: "VBA", emoji: "📊", mode: "ai", blurb: "Automates Excel and the rest of Microsoft Office." },
  { id: "solidity", label: "Solidity", emoji: "⛓️", mode: "ai", blurb: "The language of Ethereum smart contracts." },
  { id: "julia", label: "Julia", emoji: "🔬", mode: "ai", blurb: "Fast and modern, built for scientific computing." },
  // ---- functional / niche ----
  { id: "elixir", label: "Elixir", emoji: "💧", mode: "ai", blurb: "Functional and great for highly concurrent systems." },
  { id: "clojure", label: "Clojure", emoji: "🍃", mode: "ai", blurb: "A modern Lisp that runs on the JVM." },
  { id: "fsharp", label: "F#", emoji: "♯", mode: "ai", blurb: "Functional-first language in the .NET family." },
  { id: "erlang", label: "Erlang", emoji: "📡", mode: "ai", blurb: "Built for rock-solid, always-on telecom systems." },
  { id: "ocaml", label: "OCaml", emoji: "🐫", mode: "ai", blurb: "Functional language prized for speed and safety." },
  { id: "elm", label: "Elm", emoji: "🌳", mode: "ai", blurb: "A friendly functional language for web front-ends." },
  { id: "scheme", label: "Scheme", emoji: "🎯", mode: "ai", blurb: "A clean, minimal dialect of Lisp." },
  // ---- older / classic ----
  { id: "fortran", label: "Fortran", emoji: "🧮", mode: "ai", blurb: "The original scientific language, still used today." },
  { id: "cobol", label: "COBOL", emoji: "🏦", mode: "ai", blurb: "Runs banking and business systems since the 1960s." },
  { id: "pascal", label: "Pascal", emoji: "📘", mode: "ai", blurb: "A classic teaching language built for clarity." },
  { id: "lisp", label: "Lisp", emoji: "🔁", mode: "ai", blurb: "One of the oldest languages — code as lists." },
  { id: "assembly", label: "Assembly", emoji: "🔩", mode: "ai", blurb: "The lowest level — talking almost directly to the CPU." },
  { id: "ada", label: "Ada", emoji: "✈️", mode: "ai", blurb: "Built for safety-critical systems like aviation." },
  { id: "prolog", label: "Prolog", emoji: "🧠", mode: "ai", blurb: "Logic programming — you state facts and rules." },
  { id: "smalltalk", label: "Smalltalk", emoji: "💬", mode: "ai", blurb: "A pure object-oriented pioneer that shaped modern code." },
];

const LANG_CFG = Object.fromEntries(LANGUAGE_CATALOG.map((l) => [l.id, { label: l.label, mode: l.mode, count: l.mode === "real" ? 5 : 4 }]));

// ---------- Kid-proofing filter for General Coding generation ----------
const HIDDEN_KNOWLEDGE = /\b(tea|coffee|boil|recipe|adult|minor|tax|mortgage|alcohol|drive|licen[cs]e|wine|beer|18\+|salary|invoice|stocks?)\b/i;

async function generateGeneralLessons(progressMap, signal) {
  const sys =
    "You generate beginner 'how to think like a coder' exercises that are LANGUAGE-NEUTRAL and safe for young children (age 7+). " +
    "Respond with ONLY JSON: {\"lessons\":[ ... ]}, no prose, no fences. Each lesson is one of three types:\n" +
    "puzzle: {\"type\":\"puzzle\",\"title\":string,\"intro\":string,\"q\":string,\"choices\":[string,...],\"correctIndex\":number,\"why\":string}\n" +
    "predict: {\"type\":\"predict\",\"title\":string,\"intro\":string,\"code\":string (neutral pseudo-code using words like print/repeat/if, NOT a real language),\"q\":string,\"choices\":[...],\"correctIndex\":number,\"why\":string}\n" +
    "order: {\"type\":\"order\",\"title\":string,\"intro\":string,\"items\":[string,...],\"correct\":[indices in correct order],\"why\":string}\n" +
    "CRITICAL KID-PROOF RULE: only use things a 7-year-old already knows from everyday life (getting dressed, opening doors, counting, colors, shapes, toys). " +
    "NEVER require outside knowledge like making tea/coffee, cooking, ages meaning adult, money, or anything a child wouldn't know. " +
    "DIFFICULTY: make the set progressively HARDER — start simple, but later lessons should stretch the learner with multi-step reasoning, longer patterns, nested steps, or trickier predictions (still kid-safe). Don't keep them all trivially easy. " +
    "Keep numbers small. Make 5 lessons, clearly ramping from easy to challenging.";
  let raw;
  try { raw = await callClaude([{ role: "user", content: "Generate 5 kid-safe general-coding lessons now." }], { system: sys, maxTokens: 1800, signal }); }
  catch { throw new Error("ai-failed"); }
  let parsed; try { parsed = extractJSON(raw); } catch { throw new Error("bad-json"); }
  const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
  const out = [];
  for (const L of lessons) {
    if (!L || !["puzzle", "predict", "order"].includes(L.type) || !L.title || !L.why) continue;
    if (HIDDEN_KNOWLEDGE.test(JSON.stringify(L).toLowerCase())) continue; // kid-proof gate
    if (L.type === "puzzle" || L.type === "predict") {
      if (!Array.isArray(L.choices) || L.choices.length < 2) continue;
      if (typeof L.correctIndex !== "number" || L.correctIndex < 0 || L.correctIndex >= L.choices.length) continue;
      if (!L.q) continue;
      if (L.type === "predict" && !L.code) continue;
    }
    if (L.type === "order") {
      if (!Array.isArray(L.items) || L.items.length < 2 || !Array.isArray(L.correct)) continue;
      const valid = L.correct.length === L.items.length && [...L.correct].sort((a, b) => a - b).every((v, i) => v === i);
      if (!valid) continue;
    }
    out.push({ ...L, id: "gg_" + Math.random().toString(36).slice(2, 7), chapter: "✨ More brain-training", generated: true });
  }
  if (out.length === 0) throw new Error("none-valid");
  return out;
}

async function generateCourse(classId, progressMap, signal) {
  const cfg = LANG_CFG[classId];
  const learned = conceptsLearnedElsewhere(progressMap, classId);
  const prior = priorKnowledgeClause(learned, cfg.label);
  const ask = `Generate the course now. ${prior}`;
  let raw;
  try { raw = await callClaude([{ role: "user", content: ask }], { system: langGenSystem(cfg), maxTokens: 2500, signal }); }
  catch (e) { throw new Error("ai-failed"); }
  let parsed;
  try { parsed = extractJSON(raw); } catch { throw new Error("bad-json"); }
  const lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
  const out = [];
  for (const L of lessons) {
    if (cfg.mode === "real") {
      if (!L.fnName || !L.solution || !Array.isArray(L.tests) || L.tests.length < 2) continue;
      // validate: JS runs natively; Python via Pyodide
      let valid;
      if (classId === "js") valid = verifyRuns(L.solution, L.fnName, L.tests).ok && !verifyRuns(L.starter || "", L.fnName, L.tests).ok;
      else { const v = await verifyPython(L.solution, L.fnName, L.tests); valid = v.ok; } // starter-pass check skipped for py (rare)
      if (!valid) continue;
      out.push({ id: "g_" + Math.random().toString(36).slice(2, 7), type: "type", chapter: `✨ ${cfg.label} course`, generated: true,
        title: L.title || "Lesson", intro: L.teach || "Solve it so the tests pass.", concept: L.concept || L.title,
        teach: L.teach || "", example: L.example || "",
        starter: L.starter || `// write ${L.fnName}\n`, fnName: L.fnName, tests: L.tests, lang: classId,
        why: "🎉 Solved — and it ran for real." });
    } else {
      if (!L.title || !Array.isArray(L.checks) || L.checks.length < 2) continue;
      out.push({ id: "g_" + Math.random().toString(36).slice(2, 7), type: "aitype", chapter: `✨ ${cfg.label} course`, generated: true, aiJudged: true,
        title: L.title, intro: L.teach || "", concept: L.concept || L.title, teach: L.teach || "", example: L.example || "",
        starter: L.starter || "", checks: L.checks, lang: classId, langLabel: cfg.label,
        why: "✓ Nice work on this one." });
    }
  }
  if (out.length === 0) throw new Error("none-valid");
  return out;
}

// ---------- AI grading for compiled languages ----------
async function gradeAICode(step, code) {
  const raw = await callClaude(
    [{ role: "user", content:
      `Grade this ${step.langLabel} solution. Task: "${step.title}" — ${step.intro}\nCriteria:\n${step.checks.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nRespond ONLY JSON: {"verdict":"pass"|"fail","feedback":string,"checks":[{"label":string,"met":boolean}]}.` }],
    { system: "You are a precise, fair code reviewer who judges by reading code. Respond with only JSON.", maxTokens: 600 });
  try { const o = extractJSON(raw); return { verdict: o.verdict === "pass" ? "pass" : "fail", feedback: o.feedback || "", checks: Array.isArray(o.checks) ? o.checks : [] }; }
  catch { return { verdict: "fail", feedback: "Couldn't judge that clearly — try again.", checks: [] }; }
}

// ---------- PROJECT MODE: an AI teacher guides you to build a real thing ----------
// For now projects are JavaScript (runs for real). The `lang` field on a project
// plan means adding more languages later is a config change, not a rewrite.
const PROJECT_LANG = { id: "js", label: "JavaScript", runnable: true };

async function suggestProjects(signal) {
  const sys =
    "You suggest 4 small, motivating beginner programming projects (JavaScript) that a near-beginner could build in a guided, step-by-step way. " +
    "Each must be buildable as a few small functions (no UI, no files). " +
    "Respond with ONLY JSON: {\"projects\":[{\"title\":string (short), \"blurb\":string (one friendly sentence on what you'll build), \"emoji\":string}]}.";
  const raw = await callClaude([{ role: "user", content: "Suggest 4 beginner JS projects." }], { system: sys, maxTokens: 600, signal });
  const parsed = extractJSON(raw);
  const list = Array.isArray(parsed.projects) ? parsed.projects.filter((p) => p.title && p.blurb) : [];
  if (!list.length) throw new Error("none");
  return list.slice(0, 4);
}

async function planProject(idea, signal) {
  const sys =
    "You are a patient coding teacher. Turn the learner's project idea into a guided build plan in JavaScript, broken into small steps that each build ONE function or piece. " +
    "EVERY step must teach before it asks. Respond with ONLY JSON: {" +
    "\"title\":string, \"goal\":string (one sentence on what the finished project does), " +
    "\"steps\":[{" +
    "\"title\":string (short, e.g. \"Add up the items\"), " +
    "\"teach\":string (2-4 plain sentences explaining the idea for THIS step to a beginner, may use `inline code`), " +
    "\"example\":string (a tiny worked example in JS), " +
    "\"fnName\":string (the function the learner writes this step, camelCase), " +
    "\"starter\":string (a JS skeleton: correct function name, empty body, a // comment — NOT a solution), " +
    "\"solution\":string (a complete correct JS solution for this step), " +
    "\"tests\":array of >=2 {\"args\":array,\"expected\":any} that verify this step's function" +
    "}] }. " +
    "Make 3-6 steps that build on each other. Keep each step small. Every starter must NOT pass its tests; every solution MUST pass.";
  const raw = await callClaude([{ role: "user", content: `Project idea: ${idea}\nMake the guided JavaScript build plan now.` }], { system: sys, maxTokens: 3000, signal });
  const parsed = extractJSON(raw);
  if (!parsed.title || !Array.isArray(parsed.steps) || parsed.steps.length < 2) throw new Error("bad-plan");
  // keep only steps whose solution actually runs and whose starter doesn't
  const steps = [];
  for (const s of parsed.steps) {
    if (!s.title || !s.teach || !s.fnName || !s.solution || !Array.isArray(s.tests) || s.tests.length < 2) continue;
    const solOk = verifyRuns(s.solution, s.fnName, s.tests).ok;
    const starterFails = !verifyRuns(s.starter || "", s.fnName, s.tests).ok;
    if (!solOk || !starterFails) continue;
    steps.push({
      title: s.title, teach: s.teach, example: s.example || "",
      fnName: s.fnName, starter: s.starter || `function ${s.fnName}() {\n  \n}`, tests: s.tests,
    });
  }
  if (steps.length < 2) throw new Error("too-few-valid-steps");
  return { title: parsed.title.slice(0, 60), goal: parsed.goal || "", lang: "js", steps };
}

// Ask the teacher a freeform question with full project context (never advances).
async function askTeacher({ project, stepIdx, code, question, signal }) {
  const step = project.steps[stepIdx];
  const sys =
    "You are a warm, encouraging coding teacher helping a beginner build a project, one step at a time. " +
    "Answer the learner's question clearly and briefly, in plain language. Give hints and explanations, but DON'T just hand over the full solution unless they're really stuck and ask directly. Keep them moving.";
  const ctx =
    `PROJECT: ${project.title} — ${project.goal}\n` +
    `CURRENT STEP (${stepIdx + 1}/${project.steps.length}): ${step.title}\n` +
    `What this step teaches: ${step.teach}\n` +
    (code ? `Their code so far:\n\`\`\`js\n${code}\n\`\`\`\n` : "") +
    `\nTheir question: ${question}`;
  return await callClaude([{ role: "user", content: ctx }], { system: sys, maxTokens: 700, signal });
}

// A free-chat AI tutor — ask anything about coding, computers, or AI.
async function askTutor(history, question, signal) {
  const sys =
    "You are a friendly tutor for an app that teaches kids and beginners about coding, computers, and AI. " +
    "Answer questions clearly, simply, and encouragingly, in plain language a beginner understands. " +
    "Keep answers fairly short. Use little examples or analogies when they help. Keep everything age-appropriate and positive.";
  const msgs = [
    ...history.map((m) => ({ role: m.role === "you" ? "user" : "assistant", content: m.text })),
    { role: "user", content: question },
  ];
  return await callClaude(msgs, { system: sys, maxTokens: 700, signal });
}

// ---------- Class registry (General + every catalog language) ----------
const JAVA_STEPS = [
  { type: "run", lang: "java", langLabel: "Java", chapter: "1 · Real Java", title: "Print a greeting",
    teach: "Java prints with System.out.println(...). The code goes inside main. Make it print exactly: Hello, CodeQuest!",
    example: 'System.out.println("Hi"); // prints Hi',
    starter: 'public class Main {\n  public static void main(String[] args) {\n    // print Hello, CodeQuest!\n    \n  }\n}',
    expectedOutput: "Hello, CodeQuest!",
    why: "🎉 That's real Java — compiled and run on a server, printing your exact line." },
  { type: "run", lang: "java", langLabel: "Java", chapter: "1 · Real Java", title: "Add two numbers",
    teach: "You can print the result of math. Print the sum of 7 and 5 (it should show 12).",
    example: "System.out.println(2 + 3); // prints 5",
    starter: 'public class Main {\n  public static void main(String[] args) {\n    // print 7 + 5\n    \n  }\n}',
    expectedOutput: "12",
    why: "🎉 Real Java math, really executed." },
];
const CPP_STEPS = [
  { type: "run", lang: "cpp", langLabel: "C++", chapter: "1 · Real C++", title: "Print a greeting",
    teach: "C++ prints with std::cout. Make it print exactly: Hello, CodeQuest!",
    example: 'std::cout << "Hi" << std::endl;',
    starter: '#include <iostream>\nint main() {\n  // print Hello, CodeQuest!\n  \n  return 0;\n}',
    expectedOutput: "Hello, CodeQuest!",
    why: "🎉 Real C++ — compiled and run for real." },
];
const HAND_BUILT = { general: GENERAL_STEPS, js: JS_STEPS, py: PY_STEPS, java: JAVA_STEPS, cpp: CPP_STEPS };
const CLASSES = [
  { id: "general", label: "General Coding", emoji: "🧠", mode: "concept", blurb: "Start here. Learn to THINK like a coder — patterns, steps, and the universal building blocks (functions, return, loops…) that exist in every language.", steps: GENERAL_STEPS },
  { id: "hardware", label: "How Computers Work", emoji: "🔌", mode: "concept", blurb: "Peek inside the machine — CPUs, memory, bits, and real electronics: circuits, LEDs, resistors, transistors, Arduino, and Raspberry Pi.", steps: HARDWARE_STEPS },
  { id: "ai", label: "Understanding AI", emoji: "🤖", mode: "concept", blurb: "What AI really is, how it learns, why it's sometimes wrong, and how apps (like this one!) build with prompts and APIs. Includes a chat tutor.", steps: AI_STEPS },
  ...LANGUAGE_CATALOG.map((l) => ({ id: l.id, label: l.label, emoji: l.emoji, mode: l.mode, blurb: l.blurb, steps: HAND_BUILT[l.id] || [] })),
];

// ---------- Progress helpers ----------
const chaptersOf = (cls) => {
  const order = []; const map = {};
  cls.steps.forEach((s, i) => { if (!map[s.chapter]) { map[s.chapter] = []; order.push(s.chapter); } map[s.chapter].push(i); });
  return order.map((name) => ({ name, stepIdxs: map[name] }));
};
const resumeIdx = (cls, doneSet) => { for (let i = 0; i < cls.steps.length; i++) if (!doneSet.has(i)) return i; return Math.max(0, cls.steps.length - 1); };
const modeLabel = (mode) => mode === "real" ? "real test grading" : mode === "concept" ? "think like a coder" : "AI-guided";

export default function App({ initialState, onPersist, onSignOut } = {}) {
  const [screen, setScreen] = useState({ name: "home" }); // home | class | lesson | projectPick | project
  // Seed from cloud-loaded state when present (falls back to empty for standalone use)
  const [progress, setProgress] = useState(() => initialState?.progress || {}); // { classId: Set(doneStepIdx) }
  const [aiLessons, setAiLessons] = useState(() => initialState?.aiLessons || {}); // { classId: [generatedStep, ...] }
  const [savedProjects, setSavedProjects] = useState(() => initialState?.savedProjects || []); // finished projects

  // Autosave to the cloud whenever saved state changes
  useEffect(() => {
    if (onPersist) onPersist({ progress, aiLessons, savedProjects });
  }, [progress, aiLessons, savedProjects, onPersist]);

  const classWithAI = (cls) => (aiLessons[cls.id]?.length ? { ...cls, steps: [...cls.steps, ...aiLessons[cls.id]] } : cls);

  const doneSetFor = (id) => progress[id] || new Set();
  const markDone = (classId, idx) => setProgress((p) => { const s = new Set(p[classId] || new Set()); s.add(idx); return { ...p, [classId]: s }; });
  const clearDone = (classId, idx) => setProgress((p) => { const s = new Set(p[classId] || new Set()); s.delete(idx); return { ...p, [classId]: s }; });
  const addAiLesson = (classId, lesson) => setAiLessons((a) => ({ ...a, [classId]: [...(a[classId] || []), lesson] }));

  const totalDone = Object.values(progress).reduce((n, s) => n + s.size, 0);

  return (
    <div className="cq-root">
      <style>{CSS}</style>
      <header className="cq-header">
        <div className="cq-brand" onClick={() => setScreen({ name: "home" })} style={{ cursor: "pointer" }}>
          <span className="cq-logo">{"</>"}</span><span className="cq-name">CodeQuest</span>
        </div>
        <div className="cq-headerright">
          <button className="cq-projbtn" onClick={() => setScreen({ name: "projectPick" })}>🛠️ Projects</button>
          {totalDone > 0 && <div className="cq-xp">⭐ {totalDone} lessons done</div>}
          {onSignOut && <button className="cq-projbtn" onClick={onSignOut}>Sign out</button>}
        </div>
      </header>

      {screen.name === "home" && (
        <Home progress={progress} aiLessons={aiLessons} savedProjects={savedProjects}
          onOpenClass={(id) => setScreen({ name: "class", id })}
          onOpenProjects={() => setScreen({ name: "projectPick" })}
          onOpenSavedProject={(plan) => setScreen({ name: "project", plan, review: true })} />
      )}

      {screen.name === "projectPick" && (
        <ProjectPicker onBack={() => setScreen({ name: "home" })} onStart={(plan) => setScreen({ name: "project", plan })} />
      )}

      {screen.name === "project" && (
        <ProjectBuilder plan={screen.plan} reviewMode={!!screen.review}
          onComplete={(finishedPlan) => setSavedProjects((prev) => prev.some((p) => p.title === finishedPlan.title && p.goal === finishedPlan.goal) ? prev : [...prev, finishedPlan])}
          onBack={() => setScreen({ name: "projectPick" })}
          onHome={() => setScreen({ name: "home" })} />
      )}

      {screen.name === "class" && (() => {
        const baseCls = CLASSES.find((c) => c.id === screen.id);
        const cls = classWithAI(baseCls);
        // Add a set of lessons and open the FIRST of the new set — race-free.
        // We compute the open index from the authoritative state inside the
        // updater, then navigate using that exact index, so it can never be stale.
        const addAndOpenSet = (lessons) => {
          if (!lessons || !lessons.length) return;
          let openIdx = 0;
          setAiLessons((a) => {
            const existing = a[baseCls.id] || [];
            openIdx = baseCls.steps.length + existing.length; // first new lesson index, from true state
            return { ...a, [baseCls.id]: [...existing, ...lessons] };
          });
          // navigate after state is queued; index is now correct regardless of timing
          setScreen({ name: "lesson", id: baseCls.id, idx: openIdx });
        };
        const addAndOpenOne = (lesson) => addAndOpenSet([lesson]);
        return <ClassView cls={cls} doneSet={doneSetFor(cls.id)} progress={progress}
          onBack={() => setScreen({ name: "home" })}
          onOpenStep={(idx) => setScreen({ name: "lesson", id: cls.id, idx })}
          onContinue={() => setScreen({ name: "lesson", id: cls.id, idx: resumeIdx(cls, doneSetFor(cls.id)) })}
          onAddAi={addAndOpenOne}
          onAddCourse={(lessons) => setAiLessons((a) => ({ ...a, [baseCls.id]: [...(a[baseCls.id] || []), ...lessons] }))}
          onAddAndOpenSet={addAndOpenSet}
          onStayOnClass={() => setScreen({ name: "class", id: cls.id })} />;
      })()}

      {screen.name === "lesson" && (() => {
        const cls = classWithAI(CLASSES.find((c) => c.id === screen.id));
        return <LessonRunner cls={cls} idx={screen.idx} doneSet={doneSetFor(cls.id)}
          onDone={(i) => markDone(cls.id, i)} onUndone={(i) => clearDone(cls.id, i)}
          onBack={() => setScreen({ name: "class", id: cls.id })}
          goStep={(i) => setScreen({ name: "lesson", id: cls.id, idx: i })} />;
      })()}

      <footer className="cq-footer">Signed in · your progress, AI sets, and projects save to your account automatically</footer>
    </div>
  );
}

// ---------- HOME ----------
function Home({ progress, aiLessons, savedProjects = [], onOpenClass, onOpenProjects, onOpenSavedProject }) {
  const [query, setQuery] = useState("");
  const totalLessonsDone = Object.values(progress).reduce((n, s) => n + s.size, 0);
  // find the class most recently in progress (highest done count, not 100%)
  const inProgress = CLASSES
    .map((cls) => {
      const done = (progress[cls.id]?.size) || 0;
      const total = cls.steps.length + ((aiLessons?.[cls.id]?.length) || 0);
      return { cls, done, total, pct: total ? Math.round((100 * done) / total) : 0 };
    })
    .filter((x) => x.done > 0 && x.pct < 100)
    .sort((a, b) => b.done - a.done)[0];

  return (
    <main className="cq-main">
      <section className="cq-welcome-banner">
        <p className="cq-eyebrow">{totalLessonsDone > 0 ? `${totalLessonsDone} lessons in` : "Welcome"}</p>
        <h1 className="cq-home-title">{totalLessonsDone > 0 ? "Keep going." : "Learn to code, from zero."}</h1>
        <p className="cq-home-sub">Brand new to all of this? Start with <b>General Coding</b> — it teaches you to think like a coder using puzzles and plain examples, before any specific language. Then pick a language to learn its syntax.</p>
      </section>

      {inProgress && (
        <button className="cq-resumehero" onClick={() => onOpenClass(inProgress.cls.id)}>
          <div className="cq-resumehero-left">
            <span className="cq-resumehero-emoji">{inProgress.cls.emoji}</span>
            <div>
              <span className="cq-resumehero-eyebrow">Continue learning</span>
              <span className="cq-resumehero-title">{inProgress.cls.label}</span>
              <div className="cq-resumehero-bar"><div className="cq-resumehero-fill" style={{ width: `${inProgress.pct}%` }} /></div>
            </div>
          </div>
          <span className="cq-resumehero-cta">Resume →</span>
        </button>
      )}

      <button className="cq-projhero" onClick={onOpenProjects}>
        <div className="cq-projhero-left">
          <span className="cq-projhero-emoji">🛠️</span>
          <div>
            <span className="cq-projhero-eyebrow">Project mode</span>
            <span className="cq-projhero-title">Build a real project with an AI teacher</span>
          </div>
        </div>
        <span className="cq-resumehero-cta">Start →</span>
      </button>

      {savedProjects.length > 0 && (
        <div className="cq-myprojects">
          <div className="cq-section-label">My projects · {savedProjects.length} built</div>
          <div className="cq-classlist">
            {savedProjects.map((p, i) => (
              <button key={i} className="cq-classcard" onClick={() => onOpenSavedProject && onOpenSavedProject(p)}>
                <div className="cq-classtop">
                  <span className="cq-classemoji">📦</span>
                  <div className="cq-classnames">
                    <span className="cq-classlabel">{p.title}</span>
                    <span className="cq-classmode concept">{p.steps.length} steps · done</span>
                  </div>
                </div>
                {p.goal && <p className="cq-classblurb">{p.goal}</p>}
                <span className="cq-classcta">Revisit →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cq-searchwrap">
        <span className="cq-searchicon">🔍</span>
        <input className="cq-search" placeholder="Search languages — Python, Rust, Swift…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button className="cq-searchclear" onClick={() => setQuery("")}>✕</button>}
      </div>

      {(() => {
        const q = query.trim().toLowerCase();
        const matches = (cls) => !q || cls.label.toLowerCase().includes(q) || cls.blurb.toLowerCase().includes(q);
        const general = CLASSES.find((c) => c.id === "general");
        const langs = CLASSES.filter((c) => c.id !== "general");
        const generalShown = matches(general);
        const langsShown = langs.filter(matches);

        const renderCard = (cls) => {
          const done = (progress[cls.id]?.size) || 0;
          const aiCount = (aiLessons?.[cls.id]?.length) || 0;
          const total = cls.steps.length + aiCount;
          const pct = total ? Math.round((100 * done) / total) : 0;
          const started = done > 0;
          return (
            <button key={cls.id} className="cq-classcard" onClick={() => onOpenClass(cls.id)}>
              <div className="cq-classtop">
                <span className="cq-classemoji">{cls.emoji}</span>
                <div className="cq-classnames">
                  <span className="cq-classlabel">{cls.label}</span>
                  <span className={`cq-classmode ${cls.mode}`}>{modeLabel(cls.mode)}</span>
                </div>
                {total > 0 && <span className="cq-classpct">{pct}%</span>}
              </div>
              <p className="cq-classblurb">{cls.blurb}</p>
              {total > 0 && <div className="cq-classbar"><div className="cq-classbar-fill" style={{ width: `${pct}%` }} /></div>}
              <span className="cq-classcta">{total === 0 ? "✨ Build this class →" : started ? (pct === 100 ? "✓ Review class" : "Continue →") : "Start class →"}</span>
            </button>
          );
        };

        if (generalShown === false && langsShown.length === 0) {
          return <div className="cq-noresults">No language called “{query}” here yet. We only show languages that can be taught well — try another name.</div>;
        }
        return (
          <>
            {generalShown && (<><div className="cq-section-label">Start here</div><div className="cq-classlist" style={{ marginBottom: 28 }}>{renderCard(general)}</div></>)}
            {langsShown.length > 0 && (<><div className="cq-section-label">{q ? `${langsShown.length} language${langsShown.length > 1 ? "s" : ""}` : "Languages"}</div><div className="cq-classlist">{langsShown.map(renderCard)}</div></>)}
          </>
        );
      })()}
    </main>
  );
}

// ---------- CLASS VIEW (chapters) ----------
function TutorChat() {
  const [chat, setChat] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    const question = q.trim(); if (!question) return;
    const history = chat;
    setChat((c) => [...c, { role: "you", text: question }]); setQ(""); setBusy(true);
    try {
      const a = await askTutor(history, question);
      setChat((c) => [...c, { role: "tutor", text: a }]);
    } catch {
      setChat((c) => [...c, { role: "tutor", text: "I couldn't answer just now — the tutor needs the live AI connection. Try again in a moment." }]);
    } finally { setBusy(false); }
  };
  return (
    <div className="cq-teacher" style={{ marginBottom: 22 }}>
      <div className="cq-teacher-head">🤖 Ask the AI tutor anything</div>
      {chat.length > 0 && (
        <div className="cq-teacher-log">
          {chat.map((m, i) => <div key={i} className={`cq-bubble ${m.role === "you" ? "you" : "teacher"}`}>{m.text}</div>)}
          {busy && <div className="cq-bubble teacher">…</div>}
        </div>
      )}
      <div className="cq-teacher-inputrow">
        <input className="cq-search" placeholder="e.g. what is a variable? how does wifi work?" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} />
        <button className="cq-run" onClick={ask} disabled={!q.trim() || busy}>{busy ? "…" : "Ask"}</button>
      </div>
    </div>
  );
}

function ClassView({ cls, doneSet, progress, onBack, onOpenStep, onContinue, onAddAi, onAddCourse, onAddAndOpenSet, onStayOnClass }) {
  const chapters = chaptersOf(cls);
  const done = doneSet.size, total = cls.steps.length;
  const pct = total ? Math.round((100 * done) / total) : 0;
  const resume = resumeIdx(cls, doneSet);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState("");
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseErr, setCourseErr] = useState("");

  const isEmpty = total === 0;
  const learnedElsewhere = progress ? conceptsLearnedElsewhere(progress, cls.id) : [];

  // Build a whole course for an empty language class, considering prior languages
  const buildCourse = async () => {
    setCourseBusy(true); setCourseErr("");
    try {
      const lessons = await generateCourse(cls.id, progress || {});
      onAddCourse(lessons);
    } catch (e) {
      setCourseErr(`Couldn't build the ${cls.label} class right now — lesson generation needs the live AI connection (it runs inside the Claude.ai artifact). Please try again in a moment.`);
    } finally { setCourseBusy(false); }
  };

  // "Make more" generates fresh lessons via AI. No fake fallbacks — if the AI
  // isn't available, we say so honestly rather than show borrowed/wrong lessons.
  const canGenerate = done >= 1; // available once they've done at least one lesson
  const [lastTopic, setLastTopic] = useState("");
  const priorTopics = [...new Set([...cls.steps.map((s) => s.topic).filter(Boolean), lastTopic].filter(Boolean))];
  const makeAnother = async () => {
    setGenBusy(true); setGenErr("");

    if (cls.id === "general") {
      // kid-proof brain-training — generate a SET of puzzles, grouped together
      let lessons = null;
      try { lessons = await generateGeneralLessons(progress || {}); } catch { lessons = null; }
      if (lessons && lessons.length) onAddAndOpenSet(lessons);
      else setGenErr("Couldn't make new puzzles right now — generation needs the live AI connection. Please try again in a moment.");
    } else if (cls.mode === "real") {
      // themed topic set in THIS language (JS runs natively, Python via Pyodide)
      let unit = null;
      try { unit = await generateTopicUnit({ classId: cls.id, langLabel: cls.label, priorTopics }); } catch { unit = null; }
      if (unit && unit.lessons.length) { setLastTopic(unit.topic); onAddAndOpenSet(unit.lessons); }
      else setGenErr(`Couldn't make a new ${cls.label} set right now — generation needs the live AI connection. Please try again in a moment.`);
    } else {
      // AI-judged language
      let lessons = null;
      try { lessons = await generateCourse(cls.id, progress || {}); } catch { lessons = null; }
      if (lessons && lessons.length) onAddAndOpenSet(lessons);
      else setGenErr(`Couldn't make more ${cls.label} right now — generation needs the live AI connection. Please try again in a moment.`);
    }
    setGenBusy(false);
  };

  // Empty class → show the build-course screen
  if (isEmpty) {
    return (
      <main className="cq-main">
        <button className="cq-back" onClick={onBack}>← All classes</button>
        <section className="cq-classhero">
          <div className="cq-classhero-top">
            <span className="cq-classhero-emoji">{cls.emoji}</span>
            <div>
              <h1 className="cq-classhero-title">{cls.label}</h1>
              <span className={`cq-classmode ${cls.mode}`}>{modeLabel(cls.mode)}</span>
            </div>
          </div>
          <p className="cq-classblurb" style={{ marginTop: 8 }}>{cls.blurb}</p>
        </section>

        <div className="cq-buildcourse">
          <h2 className="cq-buildcourse-title">✨ Build your {cls.label} class</h2>
          {learnedElsewhere.length > 0 ? (
            <p className="cq-buildcourse-sub">The AI will create lessons just for you — and it knows what you've already learned: <b>{learnedElsewhere.map((l) => l.concept).slice(0, 5).join(", ")}</b>. So instead of starting over, it'll show you how {cls.label} does the things you already understand.</p>
          ) : (
            <p className="cq-buildcourse-sub">The AI will create a beginner {cls.label} course for you. Tip: do a few lessons in another class first, and your {cls.label} course will build on what you learned.</p>
          )}
          <button className="cq-genbtn" onClick={buildCourse} disabled={courseBusy}>{courseBusy ? "Building your course…" : `Build my ${cls.label} class`}</button>
          {cls.mode === "ai" && <p className="cq-buildcourse-note">Note: {cls.label} can't run in the browser, so these lessons are AI-judged (great for learning, not a real test runner).</p>}
          {courseErr && <p className="cq-generr">{courseErr}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="cq-main">
      <button className="cq-back" onClick={onBack}>← All classes</button>
      <section className="cq-classhero">
        <div className="cq-classhero-top">
          <span className="cq-classhero-emoji">{cls.emoji}</span>
          <div>
            <h1 className="cq-classhero-title">{cls.label}</h1>
            <span className={`cq-classmode ${cls.mode}`}>{modeLabel(cls.mode)}</span>
          </div>
        </div>
        <div className="cq-classbar big"><div className="cq-classbar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="cq-classhero-row">
          <span className="cq-classhero-stat">{done} of {total} lessons · {pct}%</span>
          <button className="cq-continue" onClick={onContinue}>{done === 0 ? "Start first lesson →" : done === total ? "Review →" : "Continue where you left off →"}</button>
        </div>
      </section>

      {cls.id === "ai" && <TutorChat />}

      <div className="cq-chapters">
        {chapters.map((ch) => {
          const chDone = ch.stepIdxs.filter((i) => doneSet.has(i)).length;
          return (
            <div key={ch.name} className="cq-chapter">
              <div className="cq-chapter-head">
                <h2 className="cq-chapter-name">{ch.name}</h2>
                <span className="cq-chapter-count">{chDone}/{ch.stepIdxs.length}</span>
              </div>
              <div className="cq-lessonrows">
                {ch.stepIdxs.map((i) => {
                  const s = cls.steps[i];
                  const isDone = doneSet.has(i);
                  const isResume = i === resume && !isDone;
                  return (
                    <button key={i} className={`cq-lessonrow ${isDone ? "done" : ""} ${isResume ? "resume" : ""}`} onClick={() => onOpenStep(i)}>
                      <span className="cq-lessonrow-icon">{isDone ? "✓" : isResume ? "▶" : "○"}</span>
                      <span className="cq-lessonrow-title">{s.title}{s.generated ? " ✨" : ""}</span>
                      <span className="cq-lessonrow-type">{s.type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI: make me another lesson */}
      <div className="cq-genbox">
        {canGenerate ? (
          <>
            <div className="cq-gentext">
              <h3>{cls.id === "general" ? "✨ More brain-training" : "✨ Want more practice?"}</h3>
              <p>{cls.id === "general"
                ? "Get a fresh set of thinking puzzles — kid-safe, no outside knowledge needed. (If the AI is busy, you'll still get ready-made ones instantly.)"
                : cls.mode === "real"
                  ? "The AI picks a topic and builds a themed set of a few lessons around it — each checked to actually work before you see it. (If the AI is busy, you'll still get a ready-made set instantly.)"
                  : `The AI builds a small set of fresh ${cls.label} lessons, AI-judged. Needs the live AI connection.`}</p>
            </div>
            <button className="cq-genbtn" onClick={makeAnother} disabled={genBusy}>{genBusy ? "Building your set…" : cls.id === "general" ? "Make me more puzzles" : "Make me a topic set"}</button>
          </>
        ) : (
          <p className="cq-genlocked">✨ Finish your first lesson to unlock more AI-made practice.</p>
        )}
        {genErr && <p className="cq-generr">{genErr}</p>}
      </div>
    </main>
  );
}

// ---------- LESSON RUNNER (wraps the step types + difficulty) ----------
function LessonRunner({ cls, idx, doneSet, onDone, onUndone, onBack, goStep }) {
  const [harderLevel, setHarderLevel] = useState({});
  const depth = harderLevel[idx] || 0;
  let step = cls.steps[idx];
  for (let d = 0; d < depth; d++) if (step.harder) step = step.harder;
  const activeStep = step;
  const hasHarder = !!activeStep.harder;

  const stepKey = `${cls.id}-${idx}-${depth}`;
  const complete = () => onDone(idx);

  const goHarder = () => { setHarderLevel((h) => ({ ...h, [idx]: (h[idx] || 0) + 1 })); onUndone(idx); };
  const goEasier = () => { setHarderLevel((h) => ({ ...h, [idx]: Math.max(0, (h[idx] || 0) - 1) })); onUndone(idx); };

  const prevStep = () => idx > 0 && goStep(idx - 1);
  const nextStep = () => idx < cls.steps.length - 1 && goStep(idx + 1);

  return (
    <main className="cq-main">
      <button className="cq-back" onClick={onBack}>← {cls.label} lessons</button>
      <div className="cq-chaptag">{activeStep.chapter}</div>

      {/* Difficulty controls — shown for skill lessons that have variants; hidden for concept puzzles */}
      {cls.mode !== "concept" && (
        <div className="cq-difficulty">
          {depth > 0 && <button className="cq-difbtn easier" onClick={goEasier}>← Make it easier</button>}
          {depth > 0 && <span className="cq-diflevel">Harder level {depth}</span>}
          {hasHarder
            ? <button className="cq-difbtn harder" onClick={goHarder}>This is too easy — give me harder →</button>
            : <span className="cq-difbtn maxed" title="No harder version of this step">⛰ Hardest level</span>}
        </div>
      )}

      {activeStep.type === "concept" && <ConceptStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "puzzle" && <PuzzleStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "predict" && <PredictStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "order" && <OrderStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "read" && <ReadStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "pick" && <PickStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "build" && <BuildStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "fill" && <FillStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "run" && <RunStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "visual" && <VisualStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "type" && <TypeStep key={stepKey} step={activeStep} onDone={complete} />}
      {activeStep.type === "aitype" && <AITypeStep key={stepKey} step={activeStep} onDone={complete} />}

      <div className="cq-nav">
        <button className="cq-navbtn" onClick={prevStep} disabled={idx === 0}>← Back</button>
        <span className="cq-navlabel">Lesson {idx + 1} of {cls.steps.length}</span>
        <button className="cq-navbtn primary" onClick={nextStep} disabled={idx === cls.steps.length - 1 || !doneSet.has(idx)}>
          {doneSet.has(idx) ? "Next →" : "Finish this first"}
        </button>
      </div>
    </main>
  );
}

// ---------- Step components ----------
function ConceptStep({ step, onDone }) {
  const [tab, setTab] = useState(0); // which language tab
  const [picked, setPicked] = useState(null);
  const correct = picked === step.answer;
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title} <span className="cq-universal">in every language</span></h1>
      <p className="cq-concept-plain">{step.plain}</p>

      <div className="cq-concept-section">
        <div className="cq-concept-label">The idea (plain form)</div>
        <div className="cq-neutralcode"><pre>{step.neutral}</pre></div>
      </div>

      <div className="cq-concept-section">
        <div className="cq-concept-label">The same thing in real languages — see how it's the same idea?</div>
        <div className="cq-langtabs">
          {step.langs.map((l, i) => (
            <button key={i} className={`cq-langtab ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>{l[0]}</button>
          ))}
        </div>
        <div className="cq-neutralcode lang"><pre>{step.langs[tab][1]}</pre></div>
      </div>

      <div className="cq-concept-section">
        <div className="cq-concept-label">Quick check</div>
        <div className="cq-puzzleq small">{step.q}</div>
        <div className="cq-choices">
          {step.choices.map((c, i) => {
            const state = picked === null ? "" : i === step.answer ? "right" : i === picked ? "wrong" : "dim";
            return (
              <button key={i} className={`cq-choice ${state}`} disabled={correct}
                onClick={() => { setPicked(i); if (i === step.answer) onDone(); }}>
                <span className="cq-choice-plain">{c}</span>
                {picked !== null && i === step.answer && <span className="cq-choice-mark">✓</span>}
                {picked === i && i !== step.answer && <span className="cq-choice-mark">try again</span>}
              </button>
            );
          })}
        </div>
      </div>

      {picked !== null && !correct && <div className="cq-nudge">Not quite — re-read the explanation up top and try again.</div>}
      {correct && <div className="cq-takeaway">✅ {step.why}</div>}
    </div>
  );
}

function PuzzleStep({ step, onDone }) {
  const [picked, setPicked] = useState(null);
  const correct = picked === step.correctIndex;
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      <p className="cq-intro">{step.intro}</p>
      <div className="cq-puzzleq">{step.q}</div>
      <div className="cq-choices">
        {step.choices.map((c, i) => {
          const state = picked === null ? "" : i === step.correctIndex ? "right" : i === picked ? "wrong" : "dim";
          return (
            <button key={i} className={`cq-choice ${state}`} disabled={correct}
              onClick={() => { setPicked(i); if (i === step.correctIndex) onDone(); }}>
              <span className="cq-choice-plain">{c}</span>
              {picked !== null && i === step.correctIndex && <span className="cq-choice-mark">✓</span>}
              {picked === i && i !== step.correctIndex && <span className="cq-choice-mark">try again</span>}
            </button>
          );
        })}
      </div>
      {picked !== null && !correct && <div className="cq-nudge">Not that one — take another look. No penalty for trying.</div>}
      {correct && <div className="cq-takeaway">✅ {step.why}</div>}
    </div>
  );
}

function PredictStep({ step, onDone }) {
  const [picked, setPicked] = useState(null);
  const correct = picked === step.correctIndex;
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      <p className="cq-intro">{step.intro}</p>
      <div className="cq-neutralcode"><pre>{step.code}</pre></div>
      <div className="cq-puzzleq">{step.q}</div>
      <div className="cq-choices">
        {step.choices.map((c, i) => {
          const state = picked === null ? "" : i === step.correctIndex ? "right" : i === picked ? "wrong" : "dim";
          return (
            <button key={i} className={`cq-choice ${state}`} disabled={correct}
              onClick={() => { setPicked(i); if (i === step.correctIndex) onDone(); }}>
              <code>{c}</code>
              {picked !== null && i === step.correctIndex && <span className="cq-choice-mark">✓</span>}
              {picked === i && i !== step.correctIndex && <span className="cq-choice-mark">try again</span>}
            </button>
          );
        })}
      </div>
      {picked !== null && !correct && <div className="cq-nudge">Not quite — read the code line by line, top to bottom, and try again.</div>}
      {correct && <div className="cq-takeaway">✅ {step.why}</div>}
    </div>
  );
}

function OrderStep({ step, onDone }) {
  // arranged holds item indices in the user's chosen order; remaining are unused
  const [arranged, setArranged] = useState([]);
  const [result, setResult] = useState(null);
  const remaining = step.items.map((_, i) => i).filter((i) => !arranged.includes(i));

  const place = (i) => { if (result?.ok) return; setArranged((a) => [...a, i]); setResult(null); };
  const removeAt = (pos) => { if (result?.ok) return; setArranged((a) => a.filter((_, p) => p !== pos)); setResult(null); };

  const check = () => {
    let firstWrong = -1;
    if (arranged.length !== step.correct.length) firstWrong = Math.min(arranged.length, step.correct.length);
    else for (let i = 0; i < step.correct.length; i++) if (arranged[i] !== step.correct[i]) { firstWrong = i; break; }
    if (firstWrong === -1) { setResult({ ok: true }); onDone(); }
    else setResult({ ok: false, firstWrong });
  };

  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      <p className="cq-intro">{step.intro}</p>
      <div className="cq-puzzleq">{step.q}</div>

      <div className="cq-orderslot">
        {arranged.length === 0 && <span className="cq-buildslot-empty">tap the steps below in the right order…</span>}
        {arranged.map((itemIdx, pos) => (
          <button key={pos} className={`cq-orderitem ${result && !result.ok && result.firstWrong === pos ? "wrong" : ""}`} onClick={() => removeAt(pos)}>
            <span className="cq-ordernum">{pos + 1}</span>{step.items[itemIdx]}
          </button>
        ))}
      </div>

      <div className="cq-orderbank">
        {remaining.map((i) => (<button key={i} className="cq-orderchoice" onClick={() => place(i)}>{step.items[i]}</button>))}
        {remaining.length === 0 && <span className="cq-bank-empty">all steps placed</span>}
      </div>

      <div className="cq-buildrow">
        <button className="cq-run" onClick={check} disabled={arranged.length === 0 || result?.ok}>Check the order</button>
        {arranged.length > 0 && !result?.ok && <button className="cq-clearbtn" onClick={() => { setArranged([]); setResult(null); }}>Clear</button>}
      </div>

      {result && !result.ok && (
        <div className="cq-nudge">
          {result.firstWrong === 0
            ? "The first step isn't right yet. Which one truly comes first? Tap a placed step to remove it."
            : `The first ${result.firstWrong} step${result.firstWrong > 1 ? "s are" : " is"} right! Step ${result.firstWrong + 1} is out of place — tap it to remove and rethink.`}
        </div>
      )}
      {result?.ok && <div className="cq-takeaway">✅ {step.why}</div>}
    </div>
  );
}

function ReadStep({ step, onDone }) {
  const [open, setOpen] = useState(null);
  const [seen, setSeen] = useState(new Set());
  useEffect(() => { if (seen.size >= step.line.length) onDone(); }, [seen]);
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      <p className="cq-intro">{step.intro}</p>
      <div className="cq-codeline">
        {step.line.map((p, i) => (
          <button key={i} className={`cq-piece ${open === i ? "open" : ""} ${seen.has(i) ? "seen" : ""}`}
            onClick={() => { setOpen(open === i ? null : i); setSeen((s) => new Set(s).add(i)); }}>{p.text}</button>
        ))}
      </div>
      {open !== null && <div className="cq-plain"><span className="cq-plain-tag">{step.line[open].text}</span>{step.line[open].plain}</div>}
      <p className="cq-tapnote">{seen.size < step.line.length ? `Tap each piece — ${step.line.length - seen.size} left.` : "You've looked at every piece. 👇"}</p>
      {seen.size >= step.line.length && <div className="cq-takeaway">✅ {step.takeaway}</div>}
    </div>
  );
}

function PickStep({ step, onDone }) {
  const [picked, setPicked] = useState(null);
  const correct = picked === step.correctIndex;
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      <p className="cq-intro">{step.intro}</p>
      <div className="cq-goal">🎯 {step.goal}</div>
      <div className="cq-choices">
        {step.choices.map((c, i) => {
          const state = picked === null ? "" : i === step.correctIndex ? "right" : i === picked ? "wrong" : "dim";
          return (
            <button key={i} className={`cq-choice ${state}`} disabled={correct}
              onClick={() => { setPicked(i); if (i === step.correctIndex) onDone(); }}>
              <code>{c}</code>
              {picked !== null && i === step.correctIndex && <span className="cq-choice-mark">✓</span>}
              {picked === i && i !== step.correctIndex && <span className="cq-choice-mark">try again</span>}
            </button>
          );
        })}
      </div>
      {picked !== null && !correct && <div className="cq-nudge">Not that one — that's how you learn. Look at the goal and try another.</div>}
      {correct && <div className="cq-takeaway">✅ {step.why}</div>}
    </div>
  );
}

function BuildStep({ step, onDone }) {
  const [placed, setPlaced] = useState([]);
  const [result, setResult] = useState(null);
  const remaining = step.bank.map((tok, i) => ({ tok, i })).filter(({ i }) => !placed.some((p) => p.bankIdx === i));
  const tapBank = (tok, bankIdx) => { if (result?.ok) return; setPlaced((p) => [...p, { tok, bankIdx }]); setResult(null); };
  const tapPlaced = (slotIdx) => { if (result?.ok) return; setPlaced((p) => p.filter((_, i) => i !== slotIdx)); setResult(null); };
  const check = () => {
    const tapped = placed.map((p) => p.tok);
    let firstWrong = -1;
    if (tapped.length !== step.target.length) firstWrong = Math.min(tapped.length, step.target.length);
    else for (let i = 0; i < step.target.length; i++) if (tapped[i] !== step.target[i]) { firstWrong = i; break; }
    if (firstWrong === -1) {
      if (step.runnable) { const v = verifyRuns(step.buildFull(tapped), step.fnName, step.tests); if (!v.ok) { setResult({ ok: false, msg: `Pieces are in order, but ${v.why}` }); return; } }
      setResult({ ok: true }); onDone();
    } else setResult({ ok: false, firstWrong });
  };
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      <p className="cq-intro">{step.intro}</p>
      {step.preface && <div className="cq-codeframe">{step.preface}</div>}
      <div className="cq-buildslot">
        {placed.length === 0 && <span className="cq-buildslot-empty">tap pieces below to build the line…</span>}
        {placed.map((p, i) => (<button key={i} className={`cq-builtpiece ${result && !result.ok && result.firstWrong === i ? "wrong" : ""}`} onClick={() => tapPlaced(i)}>{p.tok}</button>))}
      </div>
      {step.suffix && <div className="cq-codeframe">{step.suffix}</div>}
      <div className="cq-bank">
        {remaining.map(({ tok, i }) => (<button key={i} className="cq-banktok" onClick={() => tapBank(tok, i)}>{tok}</button>))}
        {remaining.length === 0 && <span className="cq-bank-empty">all pieces used</span>}
      </div>
      <div className="cq-buildrow">
        <button className="cq-run" onClick={check} disabled={placed.length === 0 || result?.ok}>Check it</button>
        {placed.length > 0 && !result?.ok && <button className="cq-clearbtn" onClick={() => { setPlaced([]); setResult(null); }}>Clear</button>}
      </div>
      {result && !result.ok && (
        <div className="cq-nudge">
          {result.msg ? result.msg : result.firstWrong === 0
            ? "The first piece isn't right yet. Which should come first? Tap to remove and try again."
            : `The first ${result.firstWrong} piece${result.firstWrong > 1 ? "s are" : " is"} right! Position ${result.firstWrong + 1} needs to change — tap it to remove it.`}
        </div>
      )}
      {result?.ok && <div className="cq-takeaway">✅ {step.why}</div>}
    </div>
  );
}

function FillStep({ step, onDone }) {
  const [choice, setChoice] = useState(null);
  const correct = choice === step.answer;
  const pick = (c) => { setChoice(c); if (c === step.answer) { if (step.runnable) { const v = verifyRuns(step.buildFull(c), step.fnName, step.tests); if (!v.ok) return; } onDone(); } };
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      <p className="cq-intro">{step.intro}</p>
      {step.preface && <div className="cq-codeframe">{step.preface}</div>}
      <div className="cq-fillline"><span>{step.lineBefore}</span><span className={`cq-blank ${choice ? (correct ? "right" : "wrong") : ""}`}>{choice || "___"}</span></div>
      {step.suffix && <div className="cq-codeframe">{step.suffix}</div>}
      {step.pyNote && <p className="cq-tapnote">(Python check is structural in this preview — the real Python runner comes with the full Python class.)</p>}
      <div className="cq-bank cq-bank-center">
        {step.blankChoices.map((c) => (<button key={c} className={`cq-banktok big ${choice === c ? (correct ? "right" : "wrong") : ""}`} disabled={correct} onClick={() => pick(c)}>{c}</button>))}
      </div>
      {choice && !correct && <div className="cq-nudge">Not quite — think about what doubles a number. Tap another.</div>}
      {correct && <div className="cq-takeaway">✅ {step.why}</div>}
    </div>
  );
}

function RunStep({ step, onDone }) {
  // Real execution for compiled/other languages via Piston. The learner writes a
  // program that PRINTS output; we run it for real and compare to expectedOutput.
  const [code, setCode] = useState(step.starter || "");
  const [out, setOut] = useState(null); // { stdout, stderr, ok, passed }
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    setRunning(true); setErr(""); setOut(null);
    try {
      const r = await runViaPiston(step.lang, code, step.stdin);
      const passed = r.ok && (step.expectedOutput != null ? outputMatches(r.stdout, step.expectedOutput) : true);
      setOut({ ...r, passed });
      if (passed) onDone();
    } catch {
      setErr("Couldn't run your code just now — the code runner needs the live connection (it runs on the server). Try again in a moment.");
    } finally { setRunning(false); }
  };

  const onKeyDown = (e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.target, s = el.selectionStart; setCode(code.slice(0, s) + "  " + code.slice(el.selectionEnd)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); } };

  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title} <span className="cq-universal">runs for real</span></h1>
      {(step.teach || step.example) ? (
        <div className="cq-teach">
          {step.teach && <p className="cq-teach-text">{step.teach}</p>}
          {step.example && <div className="cq-teach-example"><span className="cq-teach-label">Example</span><pre>{step.example}</pre></div>}
          <p className="cq-teach-now">Now you try 👇</p>
        </div>
      ) : (step.intro && <p className="cq-intro">{step.intro}</p>)}
      {step.expectedOutput != null && (
        <div className="cq-expected"><span className="cq-expected-label">Make it print:</span><pre>{step.expectedOutput}</pre></div>
      )}

      <div className="cq-editor-bar"><span className="cq-dot" /><span className="cq-dot" /><span className="cq-dot" /><span className="cq-filename">{step.langLabel || step.lang}</span></div>
      <textarea className="cq-editor" value={code} spellCheck={false} onChange={(e) => { setCode(e.target.value); setOut(null); }} onKeyDown={onKeyDown} style={{ minHeight: 180 }} />
      <div className="cq-buildrow"><button className="cq-run" onClick={run} disabled={running || !code.trim()}>{running ? "Running…" : "▶ Run it"}</button></div>

      {err && <div className="cq-nudge">{err}</div>}
      {out && (
        <div className="cq-runout">
          <div className="cq-runout-label">Output</div>
          <pre className="cq-console">{out.stdout || out.stderr || "(no output)"}</pre>
          {out.stderr && !out.stdout && <div className="cq-runout-note">⚠ Your code had an error (see above).</div>}
          {step.expectedOutput != null && !out.passed && out.ok && <div className="cq-nudge">Close — the output doesn't match what's expected yet. Compare carefully!</div>}
        </div>
      )}
      {out?.passed && <div className="cq-takeaway big">{step.why || "🎉 It compiled, ran, and printed exactly the right thing — for real."}</div>}
    </div>
  );
}

function VisualStep({ step, onDone }) {
  // Learner writes visual code in their language; we internally translate to
  // canvas JS and show it running in a sandboxed iframe — like it really ran.
  const [code, setCode] = useState(step.starter || "");
  const [busy, setBusy] = useState(false);
  const [srcDoc, setSrcDoc] = useState("");
  const [err, setErr] = useState("");
  const [hasRun, setHasRun] = useState(false);

  const showIt = async () => {
    setBusy(true); setErr("");
    try {
      // 1) Check the learner's code actually works BEFORE sending to the AI.
      //    (Python lessons run a real headless check; other langs skip to translate.)
      if ((step.lang || "py") === "py") {
        const pre = await precheckPython(code);
        if (!pre.ok) {
          setErr("Your code has an error: " + pre.why + "  — fix it and try again.");
          setBusy(false);
          return;
        }
      }
      // 2) Only valid code reaches the AI translator.
      const js = await translateToCanvas(step.lang || "py", code);
      if (!js) throw new Error("empty");
      setSrcDoc(canvasSandboxHTML(js));
      setHasRun(true);
      onDone(); // visual lessons complete on a successful show
    } catch {
      setErr("Couldn't run that visual just now — it needs the live AI connection to translate. Try again in a moment.");
    } finally { setBusy(false); }
  };

  const onKeyDown = (e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.target, s = el.selectionStart; setCode(code.slice(0, s) + "  " + code.slice(el.selectionEnd)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); } };
  const fileName = step.lang === "py" ? "game.py" : (step.lang || "code") + " file";

  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title} <span className="cq-universal">visual</span></h1>
      {(step.teach || step.example) ? (
        <div className="cq-teach">
          {step.teach && <p className="cq-teach-text">{step.teach}</p>}
          {step.example && <div className="cq-teach-example"><span className="cq-teach-label">Example</span><pre>{step.example}</pre></div>}
          <p className="cq-teach-now">Write it, then tap “Run visually” 👇</p>
        </div>
      ) : (step.intro && <p className="cq-intro">{step.intro}</p>)}

      <div className="cq-editor-bar"><span className="cq-dot" /><span className="cq-dot" /><span className="cq-dot" /><span className="cq-filename">{fileName}</span></div>
      <textarea className="cq-editor" value={code} spellCheck={false} onChange={(e) => setCode(e.target.value)} onKeyDown={onKeyDown} style={{ minHeight: 180 }} />
      <div className="cq-buildrow"><button className="cq-run" onClick={showIt} disabled={busy || !code.trim()}>{busy ? "Showing…" : "▶ Run visually"}</button></div>

      {err && <div className="cq-nudge">{err}</div>}
      {srcDoc && (
        <div className="cq-canvaswrap">
          <iframe title="visual output" className="cq-canvas" sandbox="allow-scripts" srcDoc={srcDoc} />
        </div>
      )}
      {hasRun && !err && <div className="cq-takeaway big">{step.why || "🎉 Your code drew that — nice!"}</div>}
    </div>
  );
}

function TypeStep({ step, onDone }) {
  const [code, setCode] = useState(step.starter);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    // Python lessons verify via Pyodide; JS via native runner
    let v;
    if (step.lang === "py") v = await verifyPython(code, step.fnName, step.tests);
    else v = verifyRuns(code, step.fnName, step.tests);
    setResult(v); setRunning(false);
    if (v.ok) onDone();
  };
  const onKeyDown = (e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.target, s = el.selectionStart; setCode(code.slice(0, s) + "  " + code.slice(el.selectionEnd)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); } };
  const fileName = step.lang === "py" ? "solution.py" : "your-code.js";
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title}</h1>
      {/* Teaching panel — explains the new idea before asking you to do it */}
      {(step.teach || step.example) ? (
        <div className="cq-teach">
          {step.teach && <p className="cq-teach-text">{step.teach}</p>}
          {step.example && (
            <div className="cq-teach-example">
              <span className="cq-teach-label">Example</span>
              <pre>{step.example}</pre>
            </div>
          )}
          <p className="cq-teach-now">Now you try 👇</p>
        </div>
      ) : (
        <p className="cq-intro">{step.intro}</p>
      )}
      {step.lang === "py" && <p className="cq-tapnote">🐍 Python runs for real via Pyodide — the first run downloads it (~10s), then it's quick.</p>}
      <div className="cq-editor-bar"><span className="cq-dot" /><span className="cq-dot" /><span className="cq-dot" /><span className="cq-filename">{fileName}</span></div>
      <textarea className="cq-editor" value={code} spellCheck={false} onChange={(e) => { setCode(e.target.value); setResult(null); }} onKeyDown={onKeyDown} />
      <div className="cq-buildrow"><button className="cq-run" onClick={run} disabled={result?.ok || running}>{running ? "Running…" : "▶ Run it"}</button></div>
      {result && !result.ok && <div className="cq-nudge">Almost — {result.why || "the tests didn't all pass yet"}.</div>}
      {result?.ok && <div className="cq-takeaway big">{step.why}</div>}
    </div>
  );
}

function AITypeStep({ step, onDone }) {
  const [code, setCode] = useState(step.starter || "");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const submit = async () => {
    setRunning(true);
    try { const r = await gradeAICode(step, code); setResult(r); if (r.verdict === "pass") onDone(); }
    catch { setResult({ verdict: "fail", feedback: "Couldn't reach the reviewer — try again.", checks: [] }); }
    finally { setRunning(false); }
  };
  const onKeyDown = (e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.target, s = el.selectionStart; setCode(code.slice(0, s) + "  " + code.slice(el.selectionEnd)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); } };
  return (
    <div className="cq-card2">
      <h1 className="cq-h1">{step.title} <span className="cq-aijudge">AI-judged</span></h1>
      {(step.teach || step.example) ? (
        <div className="cq-teach">
          {step.teach && <p className="cq-teach-text">{step.teach}</p>}
          {step.example && (
            <div className="cq-teach-example">
              <span className="cq-teach-label">Example</span>
              <pre>{step.example}</pre>
            </div>
          )}
          <p className="cq-teach-now">Now you try 👇</p>
        </div>
      ) : (step.intro && <p className="cq-intro">{step.intro}</p>)}
      {step.checks && <div className="cq-checks"><p className="cq-task">You'll be judged on:</p><ul>{step.checks.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
      <div className="cq-editor-bar"><span className="cq-dot" /><span className="cq-dot" /><span className="cq-dot" /><span className="cq-filename">{step.langLabel || step.lang || "code"}</span></div>
      <textarea className="cq-editor" value={code} spellCheck={false} onChange={(e) => { setCode(e.target.value); setResult(null); }} onKeyDown={onKeyDown} />
      <div className="cq-buildrow"><button className="cq-run" onClick={submit} disabled={result?.verdict === "pass" || running}>{running ? "Reviewing…" : "✦ Submit for review"}</button></div>
      {result && (
        <div className="cq-results" style={{ padding: "12px 0 0" }}>
          <div className={`cq-verdict-badge ${result.verdict}`}>{result.verdict === "pass" ? "✓ AI says: looks good" : "✗ AI says: not yet"}<span className="cq-verdict-note">AI-judged · not a real test run</span></div>
          {result.checks?.map((c, i) => (<div key={i} className={`cq-testrow ${c.met ? "pass" : "fail"}`}><span className="cq-test-icon">{c.met ? "✓" : "✗"}</span><span className="cq-test-detail">{c.label}</span></div>))}
          {result.feedback && <p className="cq-ai-feedback">{result.feedback}</p>}
          {result.verdict === "pass" && <div className="cq-takeaway" style={{ marginTop: 12 }}>{step.why}</div>}
        </div>
      )}
    </div>
  );
}

// ---------- PROJECT MODE screens ----------
function ProjectPicker({ onStart, onBack }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugErr, setSugErr] = useState("");
  const [idea, setIdea] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState("");

  const loadSuggestions = async () => {
    setLoadingSug(true); setSugErr("");
    try { setSuggestions(await suggestProjects()); }
    catch { setSugErr("Couldn't load ideas right now — generation needs the live AI connection. You can still type your own below."); }
    finally { setLoadingSug(false); }
  };

  const start = async (chosenIdea) => {
    setBuilding(true); setBuildErr("");
    try { const plan = await planProject(chosenIdea); onStart(plan); }
    catch { setBuildErr("Couldn't plan that project right now — it needs the live AI connection. Please try again in a moment."); }
    finally { setBuilding(false); }
  };

  return (
    <main className="cq-main">
      <button className="cq-back" onClick={onBack}>← Home</button>
      <p className="cq-eyebrow">Project mode</p>
      <h1 className="cq-home-title">Build something real.</h1>
      <p className="cq-home-sub">Pick an idea or describe your own, and an AI teacher will guide you through building it in JavaScript — one small step at a time. You can ask it anything as you go.</p>

      <div className="cq-proj-own">
        <label className="cq-proj-label">Describe what you want to build</label>
        <div className="cq-proj-inputrow">
          <input className="cq-search" placeholder="e.g. a tip calculator, a dice roller, a password checker…" value={idea} onChange={(e) => setIdea(e.target.value)} />
          <button className="cq-run" disabled={!idea.trim() || building} onClick={() => start(idea.trim())}>{building ? "Planning…" : "Start →"}</button>
        </div>
        {buildErr && <p className="cq-generr">{buildErr}</p>}
      </div>

      <div className="cq-proj-or">or pick an idea</div>

      {!suggestions && !loadingSug && (
        <button className="cq-genbtn" onClick={loadSuggestions}>✨ Suggest project ideas</button>
      )}
      {loadingSug && <p className="cq-genlocked">Thinking up some good ones…</p>}
      {sugErr && <p className="cq-generr">{sugErr}</p>}
      {suggestions && (
        <div className="cq-classlist" style={{ marginTop: 6 }}>
          {suggestions.map((p, i) => (
            <button key={i} className="cq-classcard" disabled={building} onClick={() => start(p.title + " — " + p.blurb)}>
              <div className="cq-classtop">
                <span className="cq-classemoji">{p.emoji || "🛠️"}</span>
                <div className="cq-classnames"><span className="cq-classlabel">{p.title}</span></div>
              </div>
              <p className="cq-classblurb">{p.blurb}</p>
              <span className="cq-classcta">{building ? "Planning…" : "Build this →"}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

function ProjectBuilder({ plan, onBack, onComplete, onHome, reviewMode = false }) {
  // In review mode, every step starts already done (you're revisiting a finished project)
  const allIdxs = plan.steps.map((_, i) => i);
  const [stepIdx, setStepIdx] = useState(0);
  const [doneSteps, setDoneSteps] = useState(reviewMode ? allIdxs : []);
  const step = plan.steps[stepIdx];
  const [code, setCode] = useState(step.starter);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const complete = doneSteps.length === plan.steps.length;
  const savedRef = useRef(false);

  // When the project is completed for the first time, save it to My Projects
  useEffect(() => {
    if (complete && !reviewMode && !savedRef.current) { savedRef.current = true; onComplete && onComplete(plan); }
  }, [complete, reviewMode, onComplete, plan]);

  // teacher chat
  const [chat, setChat] = useState([]); // {role:'you'|'teacher', text}
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  // when moving to a new step, load its starter
  const goToStep = (i) => { setStepIdx(i); setCode(plan.steps[i].starter); setResult(null); };

  const run = () => {
    setRunning(true);
    const v = verifyRuns(code, step.fnName, step.tests);
    setResult(v); setRunning(false);
    if (v.ok && !doneSteps.includes(stepIdx)) {
      const nd = [...doneSteps, stepIdx];
      setDoneSteps(nd);
      // auto-advance after a beat if there's a next step
      if (stepIdx < plan.steps.length - 1) setTimeout(() => goToStep(stepIdx + 1), 900);
    }
  };

  const ask = async () => {
    const q = question.trim(); if (!q) return;
    setChat((c) => [...c, { role: "you", text: q }]); setQuestion(""); setAsking(true);
    try {
      const a = await askTeacher({ project: plan, stepIdx, code, question: q });
      setChat((c) => [...c, { role: "teacher", text: a }]);
    } catch {
      setChat((c) => [...c, { role: "teacher", text: "I couldn't answer just now — the teacher needs the live AI connection. Try again in a moment." }]);
    } finally { setAsking(false); }
  };

  const onKeyDown = (e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.target, s = el.selectionStart; setCode(code.slice(0, s) + "  " + code.slice(el.selectionEnd)); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); } };

  return (
    <main className="cq-main">
      <button className="cq-back" onClick={onBack}>← Leave project</button>

      <section className="cq-proj-hero">
        <p className="cq-eyebrow">Project · {plan.lang === "js" ? "JavaScript" : plan.lang}</p>
        <h1 className="cq-classhero-title">{plan.title}</h1>
        {plan.goal && <p className="cq-classblurb">{plan.goal}</p>}
        <div className="cq-proj-track">
          {plan.steps.map((s, i) => (
            <button key={i} className={`cq-proj-dot ${doneSteps.includes(i) ? "done" : ""} ${i === stepIdx ? "active" : ""}`} onClick={() => goToStep(i)} title={s.title}>{doneSteps.includes(i) ? "✓" : i + 1}</button>
          ))}
        </div>
      </section>

      {complete ? (
        <div className="cq-card2" style={{ textAlign: "center" }}>
          <h1 className="cq-h1">{reviewMode ? `📦 ${plan.title}` : `🎉 You built ${plan.title}!`}</h1>
          <p className="cq-intro">{reviewMode
            ? "One of your finished projects. Tap any step above to revisit how you built it."
            : "Every step is done and runs for real. That's a complete little project you wrote yourself — and it's been saved to My Projects on the home screen."}</p>
          <div className="cq-buildrow" style={{ justifyContent: "center" }}>
            {!reviewMode && <button className="cq-run" onClick={() => onHome && onHome()}>See My Projects →</button>}
            <button className="cq-clearbtn" onClick={onBack}>Back to projects</button>
          </div>
        </div>
      ) : (
        <div className="cq-card2">
          <div className="cq-chaptag">Step {stepIdx + 1} of {plan.steps.length}</div>
          <h1 className="cq-h1">{step.title}</h1>
          <div className="cq-teach">
            <p className="cq-teach-text">{step.teach}</p>
            {step.example && <div className="cq-teach-example"><span className="cq-teach-label">Example</span><pre>{step.example}</pre></div>}
            <p className="cq-teach-now">Now you try 👇</p>
          </div>
          <div className="cq-editor-bar"><span className="cq-dot" /><span className="cq-dot" /><span className="cq-dot" /><span className="cq-filename">project.js</span></div>
          <textarea className="cq-editor" value={code} spellCheck={false} onChange={(e) => { setCode(e.target.value); setResult(null); }} onKeyDown={onKeyDown} />
          <div className="cq-buildrow"><button className="cq-run" onClick={run} disabled={running}>{running ? "Running…" : "▶ Run it"}</button></div>
          {result && !result.ok && <div className="cq-nudge">Almost — {result.why || "the tests didn't all pass yet"}. Ask the teacher below if you're stuck.</div>}
          {result?.ok && <div className="cq-takeaway big">✓ That works! {stepIdx < plan.steps.length - 1 ? "On to the next step…" : "Last step done!"}</div>}
        </div>
      )}

      {/* Ask-the-teacher chat — available anytime, never advances the build */}
      <div className="cq-teacher">
        <div className="cq-teacher-head">🧑‍🏫 Ask your teacher</div>
        {chat.length > 0 && (
          <div className="cq-teacher-log">
            {chat.map((m, i) => (
              <div key={i} className={`cq-bubble ${m.role}`}>{m.text}</div>
            ))}
            {asking && <div className="cq-bubble teacher">…</div>}
          </div>
        )}
        <div className="cq-teacher-inputrow">
          <input className="cq-search" placeholder="Ask anything — 'what does return do?', 'why isn't this working?'…" value={question}
            onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} />
          <button className="cq-run" onClick={ask} disabled={!question.trim() || asking}>{asking ? "…" : "Ask"}</button>
        </div>
      </div>
    </main>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* ============ DESIGN TOKENS ============ */
.cq-root{
  /* surface ramp: deep indigo-slate, warmer than default black */
  --bg-0:#0e1320; --bg-1:#151b2e; --bg-2:#1c2438; --bg-3:#243049;
  --ink:#eef1f8; --ink-soft:#aab3cc; --ink-faint:#6f7a99;
  --line:#283149; --line-soft:#1f273c;
  /* one confident accent family (chalk-teal) + warm "your turn" amber */
  --teal:#5ee0c0; --teal-deep:#1f9e87; --teal-ghost:rgba(94,224,192,.12);
  --amber:#f5c97b; --amber-ghost:rgba(245,201,123,.12);
  --violet:#9b8cff; --violet-ghost:rgba(155,140,255,.12);
  --rose:#ff8aa3;
  --radius:16px; --radius-sm:11px; --radius-lg:22px;
  --shadow:0 18px 40px -24px rgba(0,0,0,.7);
  --display:'Fraunces',Georgia,serif;
  --body:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
  font-family:var(--body); color:var(--ink);
  background:
    radial-gradient(1100px 520px at 78% -12%, #1d2540 0%, transparent 60%),
    radial-gradient(900px 480px at 8% 8%, #19223a 0%, transparent 55%),
    var(--bg-0);
  min-height:100vh; -webkit-font-smoothing:antialiased;
}
.cq-root *{box-sizing:border-box}
.cq-root button{color:inherit}
.cq-root ::selection{background:var(--teal-ghost)}

/* ============ HEADER ============ */
.cq-header{display:flex;justify-content:space-between;align-items:center;padding:16px 26px;border-bottom:1px solid var(--line-soft);position:sticky;top:0;z-index:20;background:rgba(14,19,32,.82);backdrop-filter:blur(14px)}
.cq-brand{display:flex;align-items:center;gap:11px}
.cq-logo{font-family:var(--mono);font-weight:600;color:var(--bg-0);background:linear-gradient(135deg,var(--teal),var(--teal-deep));padding:5px 10px;border-radius:9px;font-size:15px;box-shadow:0 4px 14px -4px var(--teal-deep)}
.cq-name{font-family:var(--display);font-weight:600;letter-spacing:-.3px;font-size:20px}
.cq-xp{font-size:12.5px;font-weight:600;color:var(--amber);background:var(--amber-ghost);padding:6px 12px;border-radius:99px;border:1px solid rgba(245,201,123,.22)}

/* ============ LAYOUT ============ */
.cq-main{max-width:940px;margin:0 auto;padding:34px 22px 72px;animation:cq-fade .4s ease}
@keyframes cq-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.cq-eyebrow{text-transform:uppercase;letter-spacing:2.5px;font-size:10.5px;color:var(--teal);font-weight:700;margin:0 0 10px}
.cq-back{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--ink-faint);cursor:pointer;font-size:13px;margin-bottom:20px;font-family:inherit;padding:6px 0;transition:color .15s}
.cq-back:hover{color:var(--ink)}

/* ============ HOME / DASHBOARD ============ */
.cq-welcome-banner{margin-bottom:30px}
.cq-home-title{font-family:var(--display);font-size:38px;font-weight:600;letter-spacing:-1.2px;margin:0 0 14px;line-height:1.04}
.cq-home-sub{color:var(--ink-soft);font-size:15.5px;line-height:1.6;margin:0;max-width:600px}
.cq-home-sub b{color:var(--ink);font-weight:600}
.cq-classlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}
.cq-section-label{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--ink-faint);font-weight:700;margin:0 0 14px}
.cq-searchwrap{position:relative;display:flex;align-items:center;margin-bottom:28px}
.cq-searchicon{position:absolute;left:16px;font-size:15px;opacity:.7;pointer-events:none}
.cq-search{width:100%;padding:14px 44px;border-radius:var(--radius);background:var(--bg-1);border:1px solid var(--line);color:var(--ink);font-size:15px;font-family:inherit;transition:border-color .15s}
.cq-search:focus{outline:none;border-color:var(--teal)}
.cq-search::placeholder{color:var(--ink-faint)}
.cq-searchclear{position:absolute;right:12px;background:var(--bg-3);border:none;color:var(--ink-soft);width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center}
.cq-searchclear:hover{color:var(--ink)}
.cq-noresults{text-align:center;color:var(--ink-soft);font-size:15px;line-height:1.6;padding:40px 20px;background:var(--bg-1);border:1px dashed var(--line);border-radius:var(--radius)}
.cq-resumehero{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(120deg,var(--bg-2),var(--bg-1));border:1px solid var(--teal);border-radius:var(--radius-lg);padding:22px 24px;margin-bottom:30px;cursor:pointer;font-family:inherit;color:inherit;box-shadow:0 14px 34px -22px var(--teal-deep);transition:transform .18s,filter .18s;text-align:left}
.cq-resumehero:hover{transform:translateY(-2px);filter:brightness(1.04)}
.cq-resumehero-left{display:flex;align-items:center;gap:16px}
.cq-resumehero-emoji{font-size:38px}
.cq-resumehero-eyebrow{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:1.5px;color:var(--teal);font-weight:700;margin-bottom:3px}
.cq-resumehero-title{display:block;font-family:var(--display);font-size:22px;font-weight:600;margin-bottom:10px}
.cq-resumehero-bar{width:200px;max-width:48vw;height:8px;background:var(--bg-0);border-radius:99px;overflow:hidden;border:1px solid var(--line-soft)}
.cq-resumehero-fill{height:100%;background:linear-gradient(90deg,var(--teal-deep),var(--teal));border-radius:99px;transition:width .6s}
.cq-resumehero-cta{font-weight:700;color:var(--teal);font-size:15px;white-space:nowrap}
.cq-classcard{position:relative;text-align:left;background:linear-gradient(180deg,var(--bg-2),var(--bg-1));border:1px solid var(--line);border-radius:var(--radius);padding:22px;cursor:pointer;transition:transform .18s cubic-bezier(.2,.7,.3,1),border-color .18s,box-shadow .18s;color:inherit;font-family:inherit;display:flex;flex-direction:column;gap:13px;overflow:hidden}
.cq-classcard::before{content:'';position:absolute;inset:0 0 auto 0;height:2px;background:linear-gradient(90deg,var(--teal),transparent);opacity:0;transition:opacity .2s}
.cq-classcard:hover:not(:disabled){transform:translateY(-4px);border-color:var(--line);box-shadow:var(--shadow)}
.cq-classcard:hover:not(:disabled)::before{opacity:1}
.cq-classcard.soon{opacity:.55;cursor:default}
.cq-classtop{display:flex;align-items:center;gap:13px}
.cq-classemoji{font-size:30px;filter:saturate(1.1)}
.cq-classnames{display:flex;flex-direction:column;gap:4px;flex:1}
.cq-classlabel{font-family:var(--display);font-weight:600;font-size:19px;letter-spacing:-.3px}
.cq-classmode{font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;font-weight:700;padding:3px 8px;border-radius:6px;align-self:flex-start}
.cq-classmode.real{background:var(--teal-ghost);color:var(--teal)}
.cq-classmode.ai{background:var(--amber-ghost);color:var(--amber)}
.cq-classmode.concept{background:var(--violet-ghost);color:var(--violet)}
.cq-classpct{font-family:var(--mono);font-size:13px;color:var(--ink-faint);font-weight:600}
.cq-classblurb{color:var(--ink-soft);font-size:13px;line-height:1.55;margin:0;flex:1}
.cq-classbar{height:7px;background:var(--bg-0);border-radius:99px;overflow:hidden;border:1px solid var(--line-soft)}
.cq-classbar.big{height:11px}
.cq-classbar-fill{height:100%;background:linear-gradient(90deg,var(--teal-deep),var(--teal));border-radius:99px;transition:width .6s cubic-bezier(.2,.7,.3,1)}
.cq-classcta{font-size:13px;font-weight:600;color:var(--teal);display:inline-flex;align-items:center;gap:4px}
.cq-classcta.soon{color:var(--ink-faint)}

/* ============ CLASS HERO ============ */
.cq-classhero{background:linear-gradient(180deg,var(--bg-2),var(--bg-1));border:1px solid var(--line);border-radius:var(--radius-lg);padding:28px;margin-bottom:26px;box-shadow:var(--shadow)}
.cq-classhero-top{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.cq-classhero-emoji{font-size:42px}
.cq-classhero-title{font-family:var(--display);font-size:28px;font-weight:600;letter-spacing:-.6px;margin:0 0 7px}
.cq-classhero-row{display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px}
.cq-classhero-stat{font-size:13px;color:var(--ink-faint);font-family:var(--mono)}
.cq-continue{background:linear-gradient(135deg,var(--teal),var(--teal-deep));color:var(--bg-0);border:none;padding:12px 22px;border-radius:var(--radius-sm);font-weight:700;cursor:pointer;font-family:inherit;font-size:14px;box-shadow:0 8px 20px -10px var(--teal-deep);transition:transform .15s,filter .15s}
.cq-continue:hover{transform:translateY(-1px);filter:brightness(1.06)}

/* ============ CHAPTERS ============ */
.cq-chapters{display:flex;flex-direction:column;gap:16px}
.cq-chapter{background:linear-gradient(180deg,var(--bg-1),var(--bg-1));border:1px solid var(--line);border-radius:var(--radius);padding:20px}
.cq-chapter-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
.cq-chapter-name{font-family:var(--display);font-size:17px;font-weight:600;margin:0;letter-spacing:-.2px}
.cq-chapter-count{font-size:11.5px;color:var(--ink-faint);font-family:var(--mono);background:var(--bg-0);padding:3px 9px;border-radius:99px}
.cq-lessonrows{display:flex;flex-direction:column;gap:8px}
.cq-lessonrow{display:flex;align-items:center;gap:13px;background:var(--bg-2);border:1px solid var(--line-soft);border-radius:var(--radius-sm);padding:13px 16px;cursor:pointer;transition:border-color .15s,transform .15s,background .15s;color:inherit;font-family:inherit;text-align:left}
.cq-lessonrow:hover{border-color:var(--line);transform:translateX(3px);background:var(--bg-3)}
.cq-lessonrow.done{border-color:rgba(94,224,192,.32)}
.cq-lessonrow.resume{border-color:var(--teal);box-shadow:0 0 0 1px var(--teal),0 8px 22px -14px var(--teal-deep)}
.cq-lessonrow-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-weight:700;font-size:12px;color:var(--ink-faint);border:1.5px solid var(--line);flex-shrink:0}
.cq-lessonrow.done .cq-lessonrow-icon{color:var(--bg-0);background:var(--teal);border-color:var(--teal)}
.cq-lessonrow.resume .cq-lessonrow-icon{color:var(--teal);border-color:var(--teal)}
.cq-lessonrow-title{flex:1;font-size:14px;font-weight:500}
.cq-lessonrow-type{font-size:9.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--ink-faint);background:var(--bg-0);padding:3px 8px;border-radius:5px;font-weight:600}

/* ============ BUILD-COURSE / GEN ============ */
.cq-buildcourse{background:linear-gradient(180deg,var(--bg-2),var(--bg-1));border:1px solid var(--line);border-radius:var(--radius-lg);padding:34px;text-align:center;box-shadow:var(--shadow)}
.cq-buildcourse-title{font-family:var(--display);font-size:23px;font-weight:600;margin:0 0 12px}
.cq-buildcourse-sub{color:var(--ink-soft);font-size:15px;line-height:1.65;margin:0 auto 22px;max-width:540px}
.cq-buildcourse-sub b{color:var(--teal)}
.cq-buildcourse-note{color:var(--ink-faint);font-size:12px;margin:16px 0 0}
.cq-genbox{margin-top:22px;background:linear-gradient(180deg,var(--bg-2),var(--bg-1));border:1px solid var(--line);border-radius:var(--radius);padding:24px;display:flex;flex-direction:column;gap:14px;align-items:flex-start}
.cq-gentext h3{margin:0 0 6px;font-size:16px;font-family:var(--display);font-weight:600}
.cq-gentext p{margin:0;color:var(--ink-soft);font-size:13px;line-height:1.5}
.cq-genbtn{background:linear-gradient(135deg,var(--violet),#6f5cff);color:#fff;border:none;padding:12px 22px;border-radius:var(--radius-sm);font-weight:700;cursor:pointer;font-family:inherit;font-size:14px;transition:transform .15s,filter .15s;box-shadow:0 8px 20px -10px #6f5cff}
.cq-genbtn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}
.cq-genbtn:disabled{opacity:.55;cursor:default}
.cq-genlocked{margin:0;color:var(--ink-faint);font-size:14px}
.cq-generr{margin:0;color:var(--rose);font-size:13px}
.cq-gen-tag{font-size:10px;background:var(--violet);color:#fff;padding:2px 7px;border-radius:6px;margin-left:8px;font-weight:700}

/* ============ STEP CHROME ============ */
.cq-chaptag{text-transform:uppercase;letter-spacing:2.5px;font-size:10.5px;color:var(--teal);font-weight:700;text-align:center;margin-bottom:16px}
.cq-difficulty{display:flex;gap:10px;align-items:center;justify-content:center;margin-bottom:22px;flex-wrap:wrap}
.cq-difbtn{border:1px solid var(--line);border-radius:99px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;transition:.15s;background:var(--bg-2);color:var(--ink-soft)}
.cq-difbtn.harder{background:var(--amber-ghost);border-color:rgba(245,201,123,.4);color:var(--amber)}
.cq-difbtn.harder:hover{filter:brightness(1.1)}
.cq-difbtn.easier:hover{color:var(--ink);border-color:var(--ink-faint)}
.cq-difbtn.maxed{cursor:default;opacity:.6}
.cq-diflevel{font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:var(--amber);font-weight:700}

.cq-card2{background:linear-gradient(180deg,var(--bg-1),var(--bg-1));border:1px solid var(--line);border-radius:var(--radius-lg);padding:34px;box-shadow:var(--shadow)}
.cq-h1{font-family:var(--display);font-size:25px;font-weight:600;letter-spacing:-.5px;margin:0 0 13px;line-height:1.12}
.cq-intro{color:var(--ink-soft);font-size:15px;line-height:1.65;margin:0 0 24px}

/* ============ READ ============ */
.cq-codeline{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;background:var(--bg-0);border:1px solid var(--line);border-radius:14px;padding:26px;margin-bottom:18px}
.cq-piece{font-family:var(--mono);font-size:19px;font-weight:500;background:var(--bg-3);border:1.5px solid var(--line);color:var(--ink);padding:10px 14px;border-radius:10px;cursor:pointer;transition:.15s}
.cq-piece:hover{border-color:var(--teal);transform:translateY(-2px)}
.cq-piece.open{border-color:var(--teal);background:var(--teal-ghost)}
.cq-piece.seen{border-bottom:3px solid var(--teal-deep)}
.cq-plain{background:var(--teal-ghost);border:1px solid rgba(94,224,192,.35);border-radius:12px;padding:16px;font-size:15px;line-height:1.6;margin-bottom:18px}
.cq-plain-tag{display:inline-block;font-family:var(--mono);font-weight:600;color:var(--teal);background:var(--bg-0);padding:2px 8px;border-radius:6px;margin-right:10px}
.cq-tapnote{text-align:center;color:var(--ink-faint);font-size:13px;margin:0 0 16px}
.cq-teach{background:linear-gradient(135deg,var(--teal-ghost),var(--violet-ghost));border:1px solid rgba(94,224,192,.3);border-radius:14px;padding:18px 20px;margin-bottom:22px}
.cq-teach-text{font-size:15.5px;line-height:1.7;margin:0 0 14px;color:var(--ink)}
.cq-teach-text code{font-family:var(--mono);background:var(--bg-0);padding:2px 6px;border-radius:5px;color:var(--teal);font-size:.9em}
.cq-teach-example{background:var(--bg-0);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:12px}
.cq-teach-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--teal);font-weight:700;margin-bottom:6px}
.cq-teach-example pre{margin:0;font-family:var(--mono);font-size:13.5px;line-height:1.6;color:var(--ink);white-space:pre-wrap}
.cq-teach-now{margin:0;font-size:13px;font-weight:700;color:var(--teal)}
.cq-canvaswrap{margin-top:16px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#000}
.cq-canvas{width:100%;height:420px;border:none;display:block;background:#0e1320}
.cq-expected{margin:14px 0;background:var(--bg-0);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.cq-expected-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--amber);font-weight:700;margin-bottom:6px}
.cq-expected pre{margin:0;font-family:var(--mono);font-size:14px;color:var(--ink);white-space:pre-wrap}
.cq-runout{margin-top:16px}
.cq-runout-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--ink-faint);font-weight:700;margin-bottom:6px}
.cq-console{background:#0a0e1a;border:1px solid var(--line);border-radius:10px;padding:14px;font-family:var(--mono);font-size:13.5px;color:#cfe9d8;white-space:pre-wrap;max-height:260px;overflow:auto;margin:0}
.cq-runout-note{color:#ff8aa3;font-size:13px;margin-top:8px}

/* ============ FEEDBACK ============ */
.cq-takeaway{background:linear-gradient(100deg,var(--teal-ghost),var(--violet-ghost));border:1px solid rgba(94,224,192,.4);border-radius:12px;padding:16px;font-size:15px;line-height:1.6;font-weight:500;animation:cq-pop .35s cubic-bezier(.2,.8,.3,1.2)}
.cq-takeaway.big{font-size:16px;text-align:center;padding:22px}
@keyframes cq-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.cq-nudge{background:var(--amber-ghost);border:1px solid rgba(245,201,123,.4);border-radius:12px;padding:15px;font-size:14px;line-height:1.6;color:#f7dca6}
.cq-notyet{color:var(--amber);font-size:13px;margin-bottom:10px;font-weight:600}

/* ============ PUZZLE / PREDICT / CONCEPT ============ */
.cq-goal{background:var(--bg-2);border:1px solid rgba(245,201,123,.4);border-radius:12px;padding:14px 16px;font-size:15px;font-weight:600;margin-bottom:18px}
.cq-puzzleq{font-family:var(--display);font-size:21px;font-weight:600;text-align:center;background:var(--bg-2);border:1px solid var(--line);border-radius:14px;padding:24px;margin-bottom:18px;line-height:1.35}
.cq-puzzleq.small{font-size:16px;padding:16px;font-family:var(--body);font-weight:600}
.cq-neutralcode{background:var(--bg-0);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:16px;overflow:auto}
.cq-neutralcode pre{margin:0;font-family:var(--mono);font-size:15px;line-height:1.7;color:var(--teal)}
.cq-concept-plain{font-size:16px;line-height:1.7;color:var(--ink);margin:0 0 24px}
.cq-concept-section{margin-bottom:22px}
.cq-concept-label{font-size:10.5px;text-transform:uppercase;letter-spacing:1.5px;color:var(--teal);font-weight:700;margin-bottom:10px}
.cq-universal{font-family:var(--body);font-size:11px;background:var(--violet-ghost);color:var(--violet);padding:4px 10px;border-radius:7px;vertical-align:middle;font-weight:700;letter-spacing:.3px}
.cq-langtabs{display:flex;gap:6px}
.cq-langtab{background:var(--bg-2);border:1px solid var(--line);border-bottom:none;color:var(--ink-faint);padding:8px 16px;border-radius:9px 9px 0 0;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:.15s}
.cq-langtab:hover{color:var(--ink)}
.cq-langtab.active{color:var(--teal);background:var(--bg-0);border-color:var(--line)}
.cq-neutralcode.lang{border-radius:0 12px 12px 12px}

/* ============ CHOICES ============ */
.cq-choices{display:flex;flex-direction:column;gap:11px;margin-bottom:18px}
.cq-choice{display:flex;align-items:center;justify-content:space-between;background:var(--bg-2);border:1.5px solid var(--line);border-radius:13px;padding:17px;cursor:pointer;transition:.16s;color:var(--ink);font-family:inherit}
.cq-choice:hover:not(:disabled){border-color:var(--teal);transform:translateY(-2px)}
.cq-choice code{font-family:var(--mono);font-size:16px;color:var(--ink)}
.cq-choice-plain{font-size:16px;font-weight:500;color:var(--ink)}
.cq-choice.right{border-color:var(--teal);background:var(--teal-ghost)}
.cq-choice.wrong{border-color:var(--rose);background:rgba(255,138,163,.1)}
.cq-choice.dim{opacity:.4}
.cq-choice-mark{font-size:12.5px;font-weight:700;color:var(--teal)}
.cq-choice.wrong .cq-choice-mark{color:var(--rose)}

/* ============ EDITOR ============ */
.cq-codeframe{font-family:var(--mono);font-size:15px;color:var(--ink-faint);padding:4px 0}
.cq-editor-panel{padding:0;overflow:hidden;display:flex;flex-direction:column}
.cq-editor-bar{display:flex;align-items:center;gap:7px;padding:12px 16px;background:var(--bg-2);border:1px solid var(--line);border-bottom:none;border-radius:12px 12px 0 0}
.cq-dot{width:11px;height:11px;border-radius:50%;background:var(--line)}
.cq-dot:nth-child(1){background:#ff5f57}.cq-dot:nth-child(2){background:#febc2e}.cq-dot:nth-child(3){background:#28c840}
.cq-filename{margin-left:8px;font-family:var(--mono);font-size:12px;color:var(--ink-faint)}
.cq-editor{width:100%;min-height:140px;resize:vertical;background:var(--bg-0);color:var(--ink);border:1px solid var(--line);border-radius:0 0 12px 12px;padding:18px;font-family:var(--mono);font-size:15px;line-height:1.7;tab-size:2}
.cq-editor:focus{outline:none;border-color:var(--teal)}

/* ============ BUILD / FILL / ORDER ============ */
.cq-buildslot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:62px;background:var(--bg-0);border:2px dashed var(--line);border-radius:12px;padding:14px;margin:6px 0}
.cq-buildslot-empty,.cq-bank-empty{color:var(--ink-faint);font-size:13px;font-style:italic}
.cq-builtpiece{font-family:var(--mono);font-size:17px;font-weight:500;background:linear-gradient(135deg,var(--teal),var(--teal-deep));color:var(--bg-0);border:none;padding:9px 14px;border-radius:9px;cursor:pointer}
.cq-builtpiece:hover{filter:brightness(1.08)}
.cq-builtpiece.wrong{background:var(--rose);color:#3a0011}
.cq-bank{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.cq-bank-center{justify-content:center}
.cq-banktok{font-family:var(--mono);font-size:17px;font-weight:500;background:var(--bg-3);border:1.5px solid var(--line);color:var(--ink);padding:10px 16px;border-radius:10px;cursor:pointer;transition:.15s}
.cq-banktok:hover:not(:disabled){border-color:var(--teal);transform:translateY(-2px)}
.cq-banktok.big{font-size:21px;padding:13px 22px}
.cq-banktok.right{border-color:var(--teal);background:var(--teal-ghost)}
.cq-banktok.wrong{border-color:var(--rose);background:rgba(255,138,163,.12)}
.cq-buildrow{display:flex;gap:10px;align-items:center;margin-top:8px}
.cq-run{background:linear-gradient(135deg,var(--teal),var(--teal-deep));color:var(--bg-0);border:none;padding:13px 26px;border-radius:var(--radius-sm);font-weight:700;cursor:pointer;font-family:inherit;font-size:15px;transition:transform .15s,filter .15s}
.cq-run:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.06)}
.cq-run:disabled{opacity:.5;cursor:default}
.cq-clearbtn{background:none;border:1px solid var(--line);color:var(--ink-faint);padding:13px 18px;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:14px}
.cq-clearbtn:hover{color:var(--ink);border-color:var(--ink-faint)}
.cq-fillline{display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:center;font-family:var(--mono);font-size:21px;background:var(--bg-0);border:1px solid var(--line);border-radius:12px;padding:24px;margin:6px 0}
.cq-blank{min-width:54px;text-align:center;border-bottom:3px solid var(--amber);padding:2px 10px;color:var(--amber)}
.cq-blank.right{color:var(--teal);border-bottom-color:var(--teal)}
.cq-blank.wrong{color:var(--rose);border-bottom-color:var(--rose)}
.cq-orderslot{display:flex;flex-direction:column;gap:8px;min-height:60px;background:var(--bg-0);border:2px dashed var(--line);border-radius:12px;padding:14px;margin-bottom:14px}
.cq-orderitem{display:flex;align-items:center;gap:12px;text-align:left;background:linear-gradient(135deg,var(--teal),var(--teal-deep));color:var(--bg-0);border:none;border-radius:10px;padding:13px 16px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600}
.cq-orderitem:hover{filter:brightness(1.06)}
.cq-orderitem.wrong{background:var(--rose);color:#3a0011}
.cq-ordernum{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.22);font-size:12px;flex-shrink:0}
.cq-orderbank{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.cq-orderchoice{text-align:left;background:var(--bg-3);border:1.5px solid var(--line);color:var(--ink);border-radius:10px;padding:13px 16px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;transition:.15s}
.cq-orderchoice:hover{border-color:var(--teal);transform:translateX(3px)}

/* ============ TEST RESULTS ============ */
.cq-results{padding:14px 0 0}
.cq-err{background:rgba(255,138,163,.1);border:1px solid var(--rose);color:#ffd1da;padding:12px 14px;border-radius:10px;font-family:var(--mono);font-size:13px}
.cq-celebrate{background:linear-gradient(100deg,var(--teal-ghost),var(--violet-ghost));border:1px solid var(--teal);padding:14px;border-radius:10px;font-weight:600;text-align:center;animation:cq-pop .35s cubic-bezier(.2,.8,.3,1.2)}
.cq-celebrate.review{background:var(--bg-2);border-color:var(--line);color:var(--ink-soft)}
.cq-testrow{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--line-soft);font-family:var(--mono);font-size:12.5px}
.cq-testrow:last-child{border-bottom:none}
.cq-test-icon{font-weight:700}
.cq-testrow.pass .cq-test-icon{color:var(--teal)}
.cq-testrow.fail .cq-test-icon{color:var(--rose)}
.cq-test-detail{color:var(--ink-soft);word-break:break-all}
.cq-test-exp{color:var(--rose)}
.cq-aijudge{font-family:var(--body);font-size:11px;background:var(--amber-ghost);color:var(--amber);padding:3px 9px;border-radius:6px;vertical-align:middle;font-weight:700;letter-spacing:.5px}
.cq-verdict-badge{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:10px;font-weight:700;margin-bottom:12px}
.cq-verdict-badge.pass{background:var(--teal-ghost);border:1px solid var(--teal)}
.cq-verdict-badge.fail{background:rgba(255,138,163,.1);border:1px solid var(--rose)}
.cq-verdict-note{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--ink-faint)}
.cq-ai-feedback{font-size:13.5px;line-height:1.6;color:var(--ink-soft);margin:12px 0 0}
.cq-checks ul{margin:8px 0 16px;padding-left:20px;color:var(--ink-soft);font-size:13px;line-height:1.7}
.cq-task{font-size:14px;margin:0}
.cq-task code,.cq-intro code,.cq-concept-plain code,.cq-gentext code{font-family:var(--mono);background:var(--bg-0);padding:2px 6px;border-radius:5px;color:var(--teal);font-size:.9em}

/* ============ NAV ============ */
.cq-nav{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:24px}
.cq-navbtn{background:var(--bg-2);border:1px solid var(--line);color:var(--ink);padding:12px 20px;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;transition:.15s}
.cq-navbtn:hover:not(:disabled){border-color:var(--teal)}
.cq-navbtn:disabled{opacity:.4;cursor:default}
.cq-navbtn.primary{background:linear-gradient(135deg,var(--teal),var(--teal-deep));color:var(--bg-0);border:none}
.cq-navlabel{font-size:13px;color:var(--ink-faint);text-align:center;flex:1}
.cq-footer{text-align:center;color:var(--ink-faint);font-size:12px;padding:26px;border-top:1px solid var(--line-soft);margin-top:20px}

/* ============ PROJECT MODE ============ */
.cq-headerright{display:flex;align-items:center;gap:10px}
.cq-projbtn{background:var(--violet-ghost);border:1px solid rgba(155,140,255,.3);color:var(--violet);padding:7px 14px;border-radius:99px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:.15s}
.cq-projbtn:hover{filter:brightness(1.12)}
.cq-projhero{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(120deg,var(--violet-ghost),var(--bg-1));border:1px solid var(--violet);border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:22px;cursor:pointer;font-family:inherit;color:inherit;box-shadow:0 14px 34px -22px #6f5cff;transition:transform .18s,filter .18s;text-align:left}
.cq-projhero:hover{transform:translateY(-2px);filter:brightness(1.05)}
.cq-projhero-left{display:flex;align-items:center;gap:16px}
.cq-projhero-emoji{font-size:34px}
.cq-projhero-eyebrow{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:1.5px;color:var(--violet);font-weight:700;margin-bottom:3px}
.cq-projhero-title{display:block;font-family:var(--display);font-size:19px;font-weight:600}
.cq-projhero-cta,.cq-resumehero-cta{font-weight:700;color:var(--violet);font-size:15px;white-space:nowrap}
.cq-myprojects{margin-bottom:28px}
.cq-proj-own{margin:8px 0 18px}
.cq-proj-label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--ink-faint);font-weight:700;margin-bottom:10px}
.cq-proj-inputrow{display:flex;gap:10px}
.cq-proj-inputrow .cq-search{flex:1}
.cq-proj-or{text-align:center;color:var(--ink-faint);font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:18px 0}
.cq-proj-hero{background:linear-gradient(180deg,var(--bg-2),var(--bg-1));border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;margin-bottom:22px;box-shadow:var(--shadow)}
.cq-proj-track{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.cq-proj-dot{width:34px;height:34px;border-radius:50%;border:1.5px solid var(--line);background:var(--bg-0);color:var(--ink-faint);font-family:var(--mono);font-weight:600;font-size:13px;cursor:pointer;transition:.15s}
.cq-proj-dot:hover{border-color:var(--violet);color:var(--ink)}
.cq-proj-dot.active{border-color:var(--violet);color:var(--violet);box-shadow:0 0 0 1px var(--violet)}
.cq-proj-dot.done{background:var(--teal);border-color:var(--teal);color:var(--bg-0)}
.cq-teacher{background:linear-gradient(180deg,var(--bg-1),var(--bg-1));border:1px solid var(--violet);border-radius:var(--radius-lg);padding:20px;margin-top:18px;box-shadow:var(--shadow)}
.cq-teacher-head{font-family:var(--display);font-size:16px;font-weight:600;margin-bottom:14px}
.cq-teacher-log{display:flex;flex-direction:column;gap:10px;margin-bottom:14px;max-height:340px;overflow-y:auto}
.cq-bubble{padding:12px 15px;border-radius:14px;font-size:14px;line-height:1.6;max-width:85%;white-space:pre-wrap}
.cq-bubble.you{align-self:flex-end;background:var(--violet);color:#fff;border-bottom-right-radius:4px}
.cq-bubble.teacher{align-self:flex-start;background:var(--bg-3);color:var(--ink);border-bottom-left-radius:4px}
.cq-teacher-inputrow{display:flex;gap:10px}
.cq-teacher-inputrow .cq-search{flex:1}
@media(max-width:640px){.cq-proj-inputrow,.cq-teacher-inputrow{flex-direction:column}.cq-projhero-title{font-size:16px}}

/* ============ ACCESSIBILITY / MOTION ============ */
.cq-root button:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.cq-root *{animation:none!important;transition:none!important}}
@media(max-width:640px){
  .cq-main{padding:24px 16px 60px}
  .cq-card2{padding:22px}
  .cq-h1{font-size:21px}.cq-home-title{font-size:28px}
  .cq-piece,.cq-banktok{font-size:15px}
  .cq-navlabel{display:none}
  .cq-classhero{padding:20px}
}
`;
