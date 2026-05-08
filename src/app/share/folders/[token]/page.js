import FolderShareClient from "./share-client";

export default async function SharedFolderPage({ params }) {
  const { token } = await params;
  return <FolderShareClient token={token} />;
}
