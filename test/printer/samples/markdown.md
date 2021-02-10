This is a markdown file with embedded Svelte content. Prettier can format this
by offloading the formatting of the fenced code block to prettier-plugin-svelte.

```svelte
<script context="module">
    const greeting = "Hello";
</script>

<script>
    const name = "world";
</script>

<h1>{greeting}, {name}!</h1>

<style>
    h1 {
        color: green;
    }
</style>
```

```svelte
<script>
    const name = "world";
</script>
```

```svelte
<h1>{greeting}, {name}!</h1>

<style>
    h1 {
        color: green;
    }
</style>
```

```svelte
<script>
    const name = "world";
</script>

<h1>{greeting}, {name}!</h1>
```

```svelte
<h1>{greeting}, {name}!</h1>
```
