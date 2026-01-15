<a href="https://deepcitation.com/">
  <img alt="DeepCitation Demo - Chat with Documents" src="app/(chat)/opengraph-image.png">
  <h1 align="center">DeepCitation Demo</h1>
</a>

<p align="center">
    Chat with your documents and get trustworthy, verifiable citations. Powered by <a href="https://deepcitation.com">DeepCitation</a> for deterministic AI citation verification.
</p>

<p align="center">
  <a href="https://deepcitation.com/docs"><strong>DeepCitation Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#how-it-works"><strong>How It Works</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- **Verifiable Citations** - Every claim is backed by citations that can be verified against your source documents
- **Visual Proof** - See exactly where in your document each citation comes from
- **Multi-File Support** - Upload and chat with multiple PDFs simultaneously
- **Trustworthy AI** - No more hallucinations - citations are deterministically verified against source material

### Built With

- [DeepCitation](https://deepcitation.com) - Deterministic AI citation verification
- [Next.js](https://nextjs.org) App Router with React Server Components
- [AI SDK](https://ai-sdk.dev/docs/introduction) - Unified API for LLMs
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) - Access multiple AI models
- [shadcn/ui](https://ui.shadcn.com) with [Tailwind CSS](https://tailwindcss.com)

## How It Works

1. **Upload Your Documents** - Upload PDF files you want to chat with
2. **Enable Citations** - The citation toggle is enabled by default when you upload files
3. **Ask Questions** - Ask anything about your documents
4. **Get Verified Answers** - Responses include inline citations that are verified against the original document
5. **Click to Verify** - Click any citation to see the exact location in your document

## Deploy Your Own

Deploy your own DeepCitation demo to Vercel with one click:

[![Deploy DeepCitation with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/nextjs-ai-chatbot)

You'll need to add your `DEEPCITATION_API_KEY` to the environment variables. Get your API key at [deepcitation.com](https://deepcitation.com).

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run the demo. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

### Environment Variables

- `DEEPCITATION_API_KEY` - Your DeepCitation API key (get one at [deepcitation.com](https://deepcitation.com))
- `AI_GATEWAY_API_KEY` - For non-Vercel deployments
- See `.env.example` for all required variables

### Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
bun install
bun db:migrate # Setup database or apply latest database changes
bun dev
```

Your app should now be running on [localhost:3000](http://localhost:3000).

## Learn More

- [DeepCitation Documentation](https://deepcitation.com/docs) - Learn about citation verification
- [DeepCitation JavaScript SDK](https://github.com/deepcitation/deepcitation-js) - Integration guide
