import type { Item } from '../types'

/**
 * AI provider abstraction.
 *
 * The app currently ships with a `MockAiProvider` so everything works offline
 * out of the box. To connect a real model later, implement the `AiProvider`
 * interface (one `complete` method) and call `configureProvider(...)` once at
 * startup — no UI code needs to change.
 *
 * Example with a hypothetical OpenAI-style client:
 *
 *   class OpenAiProvider implements AiProvider {
 *     name = 'openai'
 *     async complete(prompt: string) {
 *       const res = await fetch('https://api.openai.com/v1/chat/completions', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
 *         body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
 *       })
 *       const data = await res.json()
 *       return data.choices[0].message.content
 *     }
 *   }
 *   configureProvider(new OpenAiProvider())
 */
export interface AiProvider {
  name: string
  isMock: boolean
  complete(prompt: string, context: GenerationContext): Promise<string>
}

export interface GenerationContext {
  kind: 'hooks' | 'script' | 'visualPlan' | 'linkedin' | 'instagram'
  item: Item
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

class MockAiProvider implements AiProvider {
  name = 'mock'
  isMock = true

  async complete(_prompt: string, context: GenerationContext): Promise<string> {
    await delay(550 + Math.random() * 650)
    const { item, kind } = context
    const topic = item.title

    switch (kind) {
      case 'hooks':
        return [
          `I spent ${Math.random() > 0.5 ? '3 weeks' : 'a weekend'} building this so you don't have to — ${topic.toLowerCase()}, explained in 60 seconds.`,
          `Everyone tells you to ${pick(['use AI more', 'automate your workflow', 'ship faster'])}, but nobody shows you this part.`,
          `This one change saved me ${pick(['6 hours a week', 'a full workday', 'hours of busywork'])}. Here's the exact setup.`,
        ].join('\n\n')

      case 'script':
        return [
          `HOOK: ${topic} — I actually built it, and the result surprised me.`,
          ``,
          `0:00–0:05 — Cold open: show the end result first, no intro.`,
          `0:05–0:20 — The problem: ${item.problem || 'the frustrating, manual part of the process everyone quietly deals with'}.`,
          `0:20–0:45 — The build: the stack, the tools, and the one decision that mattered most.`,
          `0:45–0:60 — The reveal + the number nobody expects.`,
          `CTA: "I documented the whole thing — link in the comments."`,
        ].join('\n')

      case 'visualPlan':
        return [
          `Opening shot: tight close-up of the ${pick(['terminal', 'editor', 'dashboard'])} with the end result running.`,
          `Mid: split-screen — "before" on the left (manual process), "after" on the right (automated).`,
          `Overlay: big monospace numbers for the key metric (time saved / bugs caught / hours shipped).`,
          `B-roll: screen recording at 1.5x with zoom-ins on the interesting lines of code.`,
          `Closing frame: clean title card + single CTA.`,
        ].join('\n')

      case 'linkedin':
        return [
          `I built ${topic.toLowerCase()} and it changed how I think about ${item.category.toLowerCase()}.`,
          ``,
          `The setup: ${item.problem || 'I started with a painful, manual workflow and no clear plan.'}`,
          ``,
          `What worked:`,
          `• Keep the scope brutally small`,
          `• Use AI for the boring 80%, keep the judgment for yourself`,
          `• Measure one number, not ten`,
          ``,
          `The lesson: ${item.keyInsight || 'most tools fail not on tech, but on workflow fit.'}`,
          ``,
          `Full breakdown + code in the comments.`,
          `#${item.category.replace(/\s+/g, '')} #BuildInPublic #Automation`,
        ].join('\n')

      case 'instagram':
        return [
          `POV: you automated the boring part of ${item.category.toLowerCase()} and it actually worked 🤖`,
          ``,
          `What I built: ${topic}`,
          ``,
          `The result: ${pick(['6 hours saved every week', '40 bugs caught before shipping', 'a full workflow on autopilot'])}.`,
          ``,
          `Would you use this? 👇`,
          `#buildinpublic #${item.category.replace(/\s+/g, '').toLowerCase()} #creator #automation #techtok`,
        ].join('\n')

      default:
        return 'Generated draft.'
    }
  }
}

let provider: AiProvider = new MockAiProvider()

export function configureProvider(p: AiProvider): void {
  provider = p
}

export function getProvider(): AiProvider {
  return provider
}

function buildPrompt(kind: GenerationContext['kind'], item: Item): string {
  const meta = [
    `Title: ${item.title}`,
    `Category: ${item.category}`,
    `Audience: ${item.audience}`,
    `Format: ${item.format}`,
    `Problem: ${item.problem}`,
    `Key insight: ${item.keyInsight || 'n/a'}`,
  ].join('\n')

  switch (kind) {
    case 'hooks':
      return `You are a creator writing for a technical audience. Write 3 short, punchy hooks for this piece of content:\n${meta}`
    case 'script':
      return `You are a short-form scriptwriter. Write a 60-second short-form script for this content:\n${meta}`
    case 'visualPlan':
      return `You are a video producer. Write a concise visual/shot plan for this content:\n${meta}`
    case 'linkedin':
      return `You are a LinkedIn ghostwriter for technical creators. Write a LinkedIn post for this content:\n${meta}`
    case 'instagram':
      return `You are a social media manager. Write an Instagram caption for this content:\n${meta}`
    default:
      return meta
  }
}

async function generate(kind: GenerationContext['kind'], item: Item): Promise<string> {
  const prompt = buildPrompt(kind, item)
  return provider.complete(prompt, { kind, item })
}

export const ai = {
  generateHooks: (item: Item) => generate('hooks', item),
  generateScript: (item: Item) => generate('script', item),
  generateVisualPlan: (item: Item) => generate('visualPlan', item),
  generateLinkedInPost: (item: Item) => generate('linkedin', item),
  generateInstagramCaption: (item: Item) => generate('instagram', item),
}
