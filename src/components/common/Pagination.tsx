import Icon from "./Icon"
export default function Pagination() {
  return (
    <div className="pagination">
      <button>
        <Icon name="arrow" size={15} />
      </button>
      <button className="active">1</button>
      <button>2</button>
      <button>3</button>
      <span>…</span>
      <button>12</button>
      <button>
        <Icon name="arrow" size={15} />
      </button>
    </div>
  )
}
