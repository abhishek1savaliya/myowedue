import FileShareClient from "./share-client";

export const metadata = {
  title: "Shared File",
  description: "Open or request access to a shared file from OWE DUE.",
};

export default async function SharedFilePage({ params }) {
  const { token } = await params;
  return <FileShareClient token={token} />;
}
