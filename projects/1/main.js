import { message } from "discord-mini";

const DISCORD_URL = "https://discord.com/api/webhooks/1420459998730911844/DzYB9PAmf2m8MGXthQhbcGPOYb8wouu5zs9LN3Eqxf0piE7VuIZbMn5doH9mxCjn4sS0";

await message(DISCORD_URL, "Hello from npm module!");
