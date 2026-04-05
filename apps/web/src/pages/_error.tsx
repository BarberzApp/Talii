// Minimal Pages Router error page - required to prevent build crashes
// The app uses Next.js App Router for all actual routing
function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div>
      <p>{statusCode ? `Error ${statusCode}` : 'An error occurred'}</p>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: { res?: { statusCode: number }; err?: { statusCode: number } }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
