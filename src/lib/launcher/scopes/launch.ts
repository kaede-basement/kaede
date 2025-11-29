export async function launch({
  instanceId,
}: {
  "instanceId": string;
}): Promise<boolean> {
  console.log(instanceId);

  return true;
}