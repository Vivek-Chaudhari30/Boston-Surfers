/** Alias: /kiosk/<carId>?key=… → /kiosk?car=<carId>&key=… (other query params preserved). */
export async function GET(req: Request, ctx: { params: Promise<{ carId: string }> }): Promise<Response> {
  const { carId } = await ctx.params;
  const from = new URL(req.url);
  const to = new URL('/kiosk', from);
  to.searchParams.set('car', carId);
  for (const [k, v] of from.searchParams) if (k !== 'car') to.searchParams.append(k, v);
  return Response.redirect(to, 307);
}
